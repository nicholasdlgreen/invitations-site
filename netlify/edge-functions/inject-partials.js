export default async (request, context) => {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();

  const headerRes = await fetch(new URL('/header.html', request.url));
  const footerRes = await fetch(new URL('/footer.html', request.url));
  const header = headerRes.ok ? await headerRes.text() : '';
  const footer = footerRes.ok ? await footerRes.text() : '';

  html = html.replace('<!--#include file="header.html"-->', header);
  html = html.replace('<!--#include file="footer.html"-->', footer);

  return new Response(html, response);
};
