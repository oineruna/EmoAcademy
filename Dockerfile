FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY hf-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/out /usr/share/nginx/html

EXPOSE 7860

CMD sh -c 'printf "window.__EMOACADEMY_ENV__={NEXT_PUBLIC_SUPABASE_URL:\"%s\",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:\"%s\",NEXT_PUBLIC_EMOTION_API_URL:\"%s\"};\n" "$NEXT_PUBLIC_SUPABASE_URL" "$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" "$NEXT_PUBLIC_EMOTION_API_URL" > /usr/share/nginx/html/env.js && nginx -g "daemon off;"'
