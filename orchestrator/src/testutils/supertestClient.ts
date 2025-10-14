import request from 'supertest';
import app from '../server/http.js';

export function authed() {
  const agent = request(app);
  const setAuth = (req: request.Test) => req.set('Authorization', 'Bearer test');
  return {
    post: (path: string) => setAuth(agent.post(path)),
    get: (path: string) => setAuth(agent.get(path)),
  };
}


