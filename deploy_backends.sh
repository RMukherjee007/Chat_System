#!/bin/bash

# Chat System Backend
gcloud run deploy chat-backend \
  --source /Users/raghavmukherjee/Desktop/APP/server-node \
  --region us-central1 \
  --project healthy-bonsai-457316-k8 \
  --network default \
  --vpc-egress private-ranges-only \
  --add-cloudsql-instances healthy-bonsai-457316-k8:us-central1:chat-postgres \
  --set-env-vars POSTGRES_USER=postgres,POSTGRES_PASSWORD=supersecretpassword,POSTGRES_DB=chatdb,POSTGRES_HOST=/cloudsql/healthy-bonsai-457316-k8:us-central1:chat-postgres,REDIS_URL=redis://10.8.167.211:6379,MONGO_URI=mongodb://10.128.0.2:27017/chatdb,GEMINI_API_KEY=mock-key \
  --allow-unauthenticated &

# SharePlate Backend
gcloud run deploy shareplate-backend \
  --source /Users/raghavmukherjee/Desktop/SharePlate-main \
  --region us-central1 \
  --project healthy-bonsai-457316-k8 \
  --network default \
  --vpc-egress private-ranges-only \
  --add-cloudsql-instances healthy-bonsai-457316-k8:us-central1:shareplate-mysql \
  --set-env-vars DB_NAME=food_waste_redistribution_platform,DB_PASS=raghav@741,DB_USER=root,INSTANCE_UNIX_SOCKET=/cloudsql/healthy-bonsai-457316-k8:us-central1:shareplate-mysql,REDIS_URL=redis://10.8.167.211:6379 \
  --allow-unauthenticated &

# OS Tracker Backend
gcloud run deploy os-tracker-backend \
  --source /Users/raghavmukherjee/Desktop/Open_Source_Contribution_Tracker-main/os-tracker-backend \
  --region us-central1 \
  --project healthy-bonsai-457316-k8 \
  --network default \
  --vpc-egress private-ranges-only \
  --set-env-vars MONGO_URI=mongodb://10.128.0.2:27017/ostrack,REDIS_URL=redis://10.8.167.211:6379 \
  --allow-unauthenticated &

wait
echo "All backends deployed!"
