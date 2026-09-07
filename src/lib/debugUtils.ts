import {ChainType, DebugCallType} from '@/constants';

/**
 * Reverses hex string for little-endian conversion
 */
export const reverseHexString = (hexStr: string): string => {
  const cleanHex = hexStr.startsWith('0x') ? hexStr.slice(2) : hexStr;
  const reversed =
    cleanHex
      .match(/.{1,2}/g)
      ?.reverse()
      .join('') || cleanHex;
  return reversed;
};

/**
 * Basic type processing - handles numeric types with endianness correction
 */
export const processBasicType = (hexValue: string, varType: string): string => {
  if (!varType) return hexValue;

  try {
    const reversed = reverseHexString(hexValue);

    const numericTypes = [
      'int',
      'uint',
      'long',
      'ulong',
      'char',
      'uchar',
      'short',
      'ushort',
    ];
    if (numericTypes.includes(varType.toLowerCase())) {
      return BigInt('0x' + reversed).toString();
    }
  } catch (e) {
    console.warn(`Failed to process numeric type ${varType}`, e);
  }

  return hexValue;
};

/**
 * Struct type processing - expands a struct into its fields
 */
export const processStructType = async (
  hexValue: string,
  typeName: string,
  debugInfo: any[],
  chainType: ChainType,
  client: any,
  isRawData = false,
  varSize?: number,
  structure?: any,
): Promise<any> => {
  const result: {[key: string]: {type: string; value: any}} = {};

  const isSpecial = typeName.startsWith('__') && typeName.endsWith('__');
  // Avoid evaluate for special types or if isRawData is already true
  if (isSpecial) isRawData = true;

  // Find the type definition in debugInfo if not provided
  let typeDefinition: any = structure;
  if (!typeDefinition) {
    for (const code of debugInfo) {
      if (code.types && code.types[typeName]) {
        typeDefinition = code.types[typeName];
        break;
      }
    }
  }

  if (!typeDefinition || typeDefinition.__TYPE__ !== 'struct') {
    return {
      error: {
        type: 'error',
        value: `Type ${typeName} not found or not a struct`,
      },
    };
  }

  let fullStructData = '';

  if (isRawData) {
    fullStructData = hexValue;
  } else {
    // Call RPC evaluate with (hexValue, varSize)
    const evaluateResp = await client.debugCall(DebugCallType.evaluate, [
      hexValue,
      varSize,
    ]);

    if (evaluateResp && evaluateResp.result !== undefined) {
      fullStructData = String(evaluateResp.result);
    } else {
      return {
        error: {type: 'error', value: `Evaluate failed for ${typeName}`},
      };
    }
  }

  const dataForProcessing = isSpecial
    ? reverseHexString(fullStructData)
    : fullStructData;

  // Process each field
  for (const [fieldName, fieldInfo] of Object.entries(typeDefinition)) {
    if (fieldName === '__TYPE__') continue;

    const field = fieldInfo as any;
    const fieldType = field.type;
    const fieldSize = field.size;
    const fieldLoc = field.loc;

    try {
      let fieldValue = '';
      if (isSpecial) {
        // When reversed, calculate new start/end
        const start = (varSize! - fieldLoc - fieldSize) * 2;
        const end = (varSize! - fieldLoc) * 2;
        fieldValue = dataForProcessing.substring(start, end);

        if (fieldType.startsWith('*')) {
          result[fieldName] = {type: fieldType, value: '0x' + fieldValue};
        } else if (fieldType.startsWith('__') && fieldType.endsWith('__')) {
          const nestedStruct = await processStructType(
            fieldValue,
            fieldType,
            debugInfo,
            chainType,
            client,
            true,
            fieldSize,
          );
          result[fieldName] = {type: fieldType, value: nestedStruct};
        } else {
          // 基础类型直接强转 (Basic types direct cast)
          try {
            result[fieldName] = {
              type: fieldType,
              value: BigInt('0x' + fieldValue).toString(),
            };
          } catch (e) {
            console.error(`Failed to process field ${fieldName}`, e);
            result[fieldName] = {
              type: fieldType,
              value: '0x' + fieldValue,
            };
          }
        }
      } else {
        const start = fieldLoc * 2;
        const end = (fieldLoc + fieldSize) * 2;
        fieldValue = dataForProcessing.substring(start, end);

        if (fieldType.startsWith('*')) {
          result[fieldName] = {type: fieldType, value: fieldValue};
        } else if (fieldType.startsWith('__') && fieldType.endsWith('__')) {
          const nestedStruct = await processStructType(
            fieldValue,
            fieldType,
            debugInfo,
            chainType,
            client,
            false,
            fieldSize,
          );
          result[fieldName] = {type: fieldType, value: nestedStruct};
        } else {
          result[fieldName] = {
            type: fieldType,
            value: processBasicType(fieldValue, fieldType),
          };
        }
      }
    } catch (e) {
      console.error(`Failed to process field ${fieldName}`, e);
      result[fieldName] = {type: fieldType || 'unknown', value: 'Error'};
    }
  }

  return result;
};

/**
 * Main entry point for processing any variable value
 */
export const processVariableValue = async (
  hexValue: string,
  varType: string,
  debugInfo: any[],
  chainType: ChainType,
  client: any,
  varSize: number,
  structure?: any,
): Promise<any> => {
  if (varType.startsWith('*')) {
    return hexValue;
  }

  if (varType.startsWith('__') && varType.endsWith('__')) {
    return await processStructType(
      hexValue,
      varType,
      debugInfo,
      chainType,
      client,
      true, // Special structs don't use evaluate
      varSize,
      structure,
    );
  }

  return processBasicType(hexValue, varType);
};
