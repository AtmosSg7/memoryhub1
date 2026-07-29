# syntax=docker/dockerfile:1

FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .

ARG REACT_APP_API_URL=
ARG REACT_APP_ENV=production
ARG REACT_APP_SENTRY_DSN=
ARG REACT_APP_SENTRY_TRACES_SAMPLE_RATE=0.1
ARG REACT_APP_SENTRY_USER_SALT=

ENV NODE_ENV=production \
    REACT_APP_API_URL=$REACT_APP_API_URL \
    REACT_APP_ENV=$REACT_APP_ENV \
    REACT_APP_SENTRY_DSN=$REACT_APP_SENTRY_DSN \
    REACT_APP_SENTRY_TRACES_SAMPLE_RATE=$REACT_APP_SENTRY_TRACES_SAMPLE_RATE \
    REACT_APP_SENTRY_USER_SALT=$REACT_APP_SENTRY_USER_SALT \
    CI=true \
    GENERATE_SOURCEMAP=false

RUN npm run build

FROM nginx:1.27-alpine AS runtime

RUN apk add --no-cache curl

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://127.0.0.1/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
