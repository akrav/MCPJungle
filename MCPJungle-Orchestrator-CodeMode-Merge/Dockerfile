FROM gcr.io/distroless/base

# The build is handled by goreleaser
# Copy the binary from the build stage
COPY mcpjungle /mcpjungle

EXPOSE 8080
ENTRYPOINT ["/mcpjungle"]

# Run the Registry Server by default
CMD ["start"]