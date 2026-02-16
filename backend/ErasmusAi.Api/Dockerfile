# Use the official .NET SDK image to build the app
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy csproj and restore as distinct layers
COPY ["ErasmusAi.Api.csproj", "./"]
RUN dotnet restore "ErasmusAi.Api.csproj"

# Copy everything else and build
COPY . .
WORKDIR "/src/."
RUN dotnet build "ErasmusAi.Api.csproj" -c Release -o /app/build

# Publish the application
FROM build AS publish
RUN dotnet publish "ErasmusAi.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Final stage/image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "ErasmusAi.Api.dll"]
