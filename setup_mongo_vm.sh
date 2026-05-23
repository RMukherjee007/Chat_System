#!/bin/bash
gcloud compute instances create mongodb-server \
  --project=healthy-bonsai-457316-k8 \
  --zone=us-central1-a \
  --machine-type=e2-micro \
  --image-family=debian-11 \
  --image-project=debian-cloud \
  --tags=mongodb-server \
  --metadata=startup-script="#!/bin/bash
sudo apt-get update
sudo apt-get install -y gnupg curl
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | \
   sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo 'deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.org/apt/debian bullseye/mongodb-org/7.0 main' | \
   sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo sed -i 's/bindIp: 127.0.0.1/bindIp: 0.0.0.0/' /etc/mongod.conf
sudo systemctl enable mongod
sudo systemctl start mongod"

# Allow internal traffic to port 27017
gcloud compute firewall-rules create allow-mongodb-internal \
  --project=healthy-bonsai-457316-k8 \
  --direction=INGRESS \
  --priority=1000 \
  --network=default \
  --action=ALLOW \
  --rules=tcp:27017 \
  --source-ranges=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
