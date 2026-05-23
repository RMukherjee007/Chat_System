#!/bin/bash

# Chat System Frontend
cd /Users/raghavmukherjee/Desktop/APP/client
find src -type f -name "*.tsx" -o -name "*.ts" -exec sed -i '' 's|http://localhost:3001|https://chat-backend-883918498227.us-central1.run.app|g' {} +
gcloud run deploy chat-frontend \
  --source . \
  --region us-central1 \
  --project healthy-bonsai-457316-k8 \
  --allow-unauthenticated &

# SharePlate Frontend
cd /Users/raghavmukherjee/Desktop/SharePlate-main/client
find src -type f -name "*.jsx" -o -name "*.js" -exec sed -i '' "s|fetch('/api/|fetch('https://shareplate-backend-883918498227.us-central1.run.app/api/|g" {} +
find src -type f -name "*.jsx" -o -name "*.js" -exec sed -i '' "s|\`/api/|\`https://shareplate-backend-883918498227.us-central1.run.app/api/|g" {} +
gcloud run deploy shareplate-frontend \
  --source . \
  --region us-central1 \
  --project healthy-bonsai-457316-k8 \
  --allow-unauthenticated &

# OS Tracker Frontend
cd /Users/raghavmukherjee/Desktop/Open_Source_Contribution_Tracker-main/os-tracker-frontend
find src -type f -name "*.jsx" -o -name "*.js" -exec sed -i '' "s|http://localhost:5001|https://os-tracker-backend-883918498227.us-central1.run.app|g" {} +
find src -type f -name "*.jsx" -o -name "*.js" -exec sed -i '' "s|/api/github/|https://os-tracker-backend-883918498227.us-central1.run.app/api/github/|g" {} +
gcloud run deploy os-tracker-frontend \
  --source . \
  --region us-central1 \
  --project healthy-bonsai-457316-k8 \
  --allow-unauthenticated &

wait
echo "All frontends deployed!"
