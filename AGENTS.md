# AppMozo - Restaurant POS Mobile App

React Native / Expo (SDK 54) frontend for a restaurant waiter POS system. Pure JavaScript — no TypeScript, ESLint, Prettier, or test framework configured.

## Cursor Cloud specific instructions

### Running the app

- **Dev server (web):** `npx expo start --web --port 8081` — runs the app in a browser at `http://localhost:8081`.
- **Web support:** `react-native-web` and `@expo/metro-runtime` must be installed (the update script handles this).
- The app is a frontend-only client. It requires a separate backend server (`Backend-LasGambusinas` — Node.js/Express + Socket.io on port 3000 with MongoDB) which is **not** included in this repo. Without the backend, the login screen renders and accepts input but authentication requests will timeout.
- The backend API URL defaults to `http://192.168.18.11:3000/api` (persisted in AsyncStorage). It can be changed via the in-app Settings modal (gear icon on login screen).

### Key caveats

- No lint, test, or type-check scripts exist in `package.json`. The only defined scripts are `start`, `android`, `ios`, and `web`.
- The `mongoose` dependency in `package.json` is unusual for a frontend app — likely a leftover.
- The `.env` file sets `REACT_APP_API_BASE_URL` and `REACT_APP_API_COMANDA` but the app primarily uses `config/apiConfig.js` (AsyncStorage-based) for API URL resolution.
- The `%ProgramData%` directory is an artifact from Windows and can be ignored.
- `npx expo export --platform web` can be used to verify the project builds without starting a dev server.
