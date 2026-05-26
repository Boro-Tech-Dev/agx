FROM node:20-alpine
WORKDIR /app
COPY apps/web-dashboard/package.json ./package.json
RUN npm install
COPY apps/web-dashboard .
COPY config/scenario_planner ./config/scenario_planner
COPY config/brief_generator ./config/brief_generator
COPY config/tactic_library ./config/tactic_library
ENV AGENT_API_URL=http://agent-api:8080
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
CMD ["npm", "run", "start"]
