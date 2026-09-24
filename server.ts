import { server } from "./server/index.js";

const port = Number(process.env.PORT ?? 3000);

server.listen(port, () => {
  console.log(`WeatherAI running on port ${port}`);
});