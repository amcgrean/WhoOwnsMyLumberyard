import next from "eslint-config-next";

const config = [
  ...(Array.isArray(next) ? next : [next]),
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "drizzle/**",
      "data/**",
    ],
  },
];

export default config;
