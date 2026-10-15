FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY . .
RUN chmod +x mvnw
RUN ./mvnw clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 10000
# Render Free 512MB — số đo & lý do từng cờ: docs/BACKEND_RENDER_DEPLOY.md
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=35 -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:ReservedCodeCacheSize=48m -XX:MaxMetaspaceSize=200m -Xss512k -XX:+ExitOnOutOfMemoryError"
ENTRYPOINT ["java", "-Djava.net.preferIPv4Stack=true", "-Djava.net.preferIPv4Addresses=true", "-jar", "app.jar"]