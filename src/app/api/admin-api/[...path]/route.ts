import {NextRequest, NextResponse} from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  {params}: {params: Promise<{path: string[]}>},
) {
  try {
    const {path} = await params;
    const targetPath = path.join('/');

    const adminApiUrl =
      process.env.ADMIN_API_URL || 'http://omegasuite.org:8888';

    const bodyText = await request.text();

    const headers = new Headers();
    request.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'host') {
        headers.set(key, value);
      }
    });

    const targetUrl = `${adminApiUrl}/${targetPath}`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: bodyText,
    });

    const responseBody = await response.text();

    const resHeaders = new Headers();
    response.headers.forEach((value, key) => {
      resHeaders.set(key, value);
    });

    return new NextResponse(responseBody, {
      status: response.status,
      headers: resHeaders,
    });
  } catch (error: any) {
    console.error('Failed to proxy request:', error);
    return NextResponse.json(
      {code: -1, msg: `Proxy error: ${error.message || 'Unknown error'}`},
      {status: 500},
    );
  }
}
