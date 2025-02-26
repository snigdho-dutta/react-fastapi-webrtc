#!/bin/bash
cd deployment
docker-compose up -d --remove-orphans --build
cd ..