fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Use the bundled protoc binary so the build works without a system install.
    let protoc = protoc_bin_vendored::protoc_bin_path()?;
    std::env::set_var("PROTOC", protoc);

    tonic_build::configure()
        .build_server(false) // we are a gRPC client only
        .compile(&["proto/service.proto"], &["proto"])?;

    Ok(())
}
