import http from 'node:http';

// Local-only fail-closed stub. Integration tests use MockWebServer with explicit responses.
// No forwarding, credentials, logging of bodies, or calls to external platforms.
http.createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json');
  if (request.url === '/health') {
    response.end(JSON.stringify({ status: 'isolated' }));
    return;
  }
  // Khung giờ vàng cố định (mặc định nền tảng) để thử /schedules/suggested-slots — không có dữ liệu thật.
  if (request.method === 'POST' && request.url === '/golden-hours') {
    response.end(JSON.stringify({ platform: 'facebook', data_driven: false, suggested_hours: ['11:00-12:00', '20:00-21:00'] }));
    return;
  }
  response.statusCode = 503;
  response.end(JSON.stringify({ error: { message: 'Isolated stub: configure a test response', code: 1 } }));
}).listen(58080, '127.0.0.1', () => console.log('Isolated stub listening on 127.0.0.1:58080'));
