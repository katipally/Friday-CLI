# Friday CLI
# Open-source multi-provider AI coding agent for the terminal

class FridayCli < Formula
  desc "Open-source multi-provider AI coding agent for the terminal"
  homepage "https://github.com/anthropic-ai/friday-cli"
  url "https://github.com/anthropic-ai/friday-cli/archive/refs/tags/v__VERSION__.tar.gz"
  sha256 "__SHA256__"
  license "MIT"

  depends_on "node@20"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match "friday", shell_output("#{bin}/friday --version")
  end
end
