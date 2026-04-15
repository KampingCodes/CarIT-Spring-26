# SWE-Practicum-AI-Diagnostic-Tool

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
npm install vue3-google-signin
npm install vue-router@4
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

### Environment File
Put a .env file in the root of the project with the following details:
```
GENAI_API_KEY=<google_genai_api_key>
MONGODB_URI=mongodb+srv://<username>:<password>@ai-diagnostic-tool-proj.njtobnl.mongodb.net/?appName=AI-Diagnostic-Tool-Project
VITE_AUTH0_DOMAIN=dev-4h6xdz700e55oeeo.us.auth0.com
VITE_AUTH0_CLIENT_ID=ZhtmRqp1qTd9RJETvVP70tVfJyI81Ceb
VITE_AUTH0_AUDIENCE=https://carit-api
AUTH0_AUDIENCE=https://carit-api
AUTH0_DOMAIN=dev-4h6xdz700e55oeeo.us.auth0.com
```

## Server Setup
Run the `server/server.js` file using `node` to start the server. This will let the client talk to the server, and in turn, the database.
```shell
node server/server.js
```

## MongoDB Database
Go [here](https://cloud.mongodb.com/) to view the database.
