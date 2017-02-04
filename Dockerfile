FROM choros

MAINTAINER Georg Grab

ARG CACHE_DATE=2017-01-29
RUN git clone https://github.com/Chorknaben/chr-cms /Backend

COPY server.js /Backend/server.js
COPY server.config /Backend/server.config

VOLUME /data
VOLUME /Servertools

RUN mkdir /Backend/temp
RUN rm -rf /Backend/bilderStrukturen && ln -s /bilderStrukturen /Backend/bilderStrukturen

WORKDIR "/Backend"
ENTRYPOINT ["/usr/bin/nodejs", "./server.js"]
