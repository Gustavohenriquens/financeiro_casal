// Entrada serverless da Vercel: toda requisição /api/* chega aqui e é tratada pelo Express.
import { createApp } from '../server/src/app.js';

export default createApp();
