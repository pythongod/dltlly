#!/bin/bash

# Function to exit in case of an error
exit_on_error() {
    echo "An error occurred: $1"
    exit 1
}

git init https://${GIT_USER}:${GIT_TOKEN}@github.com/pythongod/dltlly.git || exit_on_error "Failed to init git"
