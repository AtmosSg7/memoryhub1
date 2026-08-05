# syntax=docker/dockerfile:1

FROM nginx:1.27-alpine

# curl/openssl only — do NOT install Alpine nginx-mod-http-brotli.
# That package targets Alpine's nginx build and is ABI-incompatible with
# the official nginx image (module version mismatch → crash loop).
RUN apk add --no-cache curl openssl

# Placeholder: keep include path in nginx.conf stable; no dynamic modules loaded.
RUN printf '# No third-party modules (Brotli optional / disabled)\n' > /etc/nginx/modules-brotli.conf

COPY nginx.conf /etc/nginx/nginx.conf
COPY conf.d/ /etc/nginx/conf.d/
COPY snippets/ /etc/nginx/snippets/
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8080/health || exit 1

EXPOSE 80 443 8080

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
