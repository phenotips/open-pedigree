FROM node:14

# create the app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# install any dependencies
# we copy package*.json over to make use of docker's cached builds
COPY package*.json .
RUN npm install \
    && npm cache clean --force

# copy over the rest of the source code
COPY . .

# run the application and make it available outside the container
CMD ["npm", "run", "start-docker"]
EXPOSE 9000
