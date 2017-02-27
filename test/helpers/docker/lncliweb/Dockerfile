FROM node:6

MAINTAINER Michiel de Jong <michiel@ripple.com>

# Expose http port.
EXPOSE 8280

RUN git clone https://github.com/mably/lncli-web /app
RUN cd /app && npm install
CMD cd /app && node server -l alice:10009 -h 0.0.0.0
