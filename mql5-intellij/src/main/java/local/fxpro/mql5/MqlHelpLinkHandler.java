package local.fxpro.mql5;

import com.intellij.ide.BrowserUtil;
import com.intellij.openapi.application.ApplicationManager;
import com.intellij.platform.backend.documentation.DocumentationLinkHandler;
import com.intellij.platform.backend.documentation.DocumentationTarget;
import com.intellij.platform.backend.documentation.LinkResolveResult;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.function.Consumer;

/** Opens explicit local MQL5 help links through the IDE's browser launcher. */
public final class MqlHelpLinkHandler implements DocumentationLinkHandler {
  private final Consumer<Path> browser;

  public MqlHelpLinkHandler() {
    this(path -> ApplicationManager.getApplication().invokeLater(() -> BrowserUtil.browse(path)));
  }

  MqlHelpLinkHandler(Consumer<Path> browser) { this.browser = browser; }

  boolean openLink(String url) {
    if (!url.startsWith("mql5-help:")) return false;
    try {
      URI file = URI.create(url.substring("mql5-help:".length()));
      if (!"file".equals(file.getScheme()) || file.getRawQuery() != null || file.getRawFragment() != null) return false;
      Path path = Path.of(file).toAbsolutePath().normalize();
      String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
      if (!(name.endsWith(".htm") || name.endsWith(".html")) || !Files.isRegularFile(path)) return false;
      browser.accept(path);
      return true;
    } catch (IllegalArgumentException exception) {
      return false;
    }
  }

  @Override public LinkResolveResult resolveLink(DocumentationTarget target, String url) {
    return openLink(url) ? LinkResolveResult.resolvedTarget(target) : null;
  }
}
