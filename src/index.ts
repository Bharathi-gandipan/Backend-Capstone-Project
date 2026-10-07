import { createApp } from './app';

const PORT = process.env.PORT || 3000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Bookstore E-Commerce Platform Backend is DEPLOYED!    `);
  console.log(` Port: http://localhost:${PORT}                        `);
  console.log(` Health & Info: http://localhost:${PORT}/              `);
  console.log(` API Docs:      http://localhost:${PORT}/api/docs      `);
  console.log(`=======================================================`);
});
