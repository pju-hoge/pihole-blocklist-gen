console.log("BACKGROUND SCRIPT STARTED (V1.1)");

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension Installed/Updated");
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "block-domain",
      title: "Block Domain (Pi-hole)",
      contexts: ["image", "frame", "link", "page"]
    }, () => {
        console.log("Context menu 'block-domain' created.");
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log("Context menu clicked! Info:", info);

  // Fallback for notification if logic fails
  try {
      if (info.menuItemId === "block-domain") {
        let targetUrl = info.srcUrl || info.frameUrl || info.linkUrl || info.pageUrl;
        console.log("Processing URL:", targetUrl);

        if (!targetUrl) {
          notifyUser("Error", "No URL found.");
          return;
        }

        try {
          const url = new URL(targetUrl);
          const domain = url.hostname;
          notifyUser("Processing", `Domain: ${domain}`); // Immediate feedback
          triggerGitHubAction(domain);
        } catch (e) {
          console.error("URL Error:", e);
          notifyUser("Error", "Invalid URL format.");
        }
      }
  } catch(err) {
      console.error("Top level error in click handler:", err);
  }
});

async function triggerGitHubAction(domain) {
  try {
    const data = await chrome.storage.sync.get(["githubUser", "githubRepo", "githubPat"]);
    const { githubUser, githubRepo, githubPat } = data;

    if (!githubUser || !githubRepo || !githubPat) {
      notifyUser("Setup Required", "Please check Extension Options.");
      chrome.runtime.openOptionsPage();
      return;
    }

    const apiUrl = `https://api.github.com/repos/${githubUser}/${githubRepo}/dispatches`;
    
    // Explicitly log the fetch attempt
    console.log(`Fetching: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `token ${githubPat}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        event_type: "block_domain",
        client_payload: {
          domain: domain
        }
      })
    });

    if (response.ok) {
        console.log("GitHub Request Success");
        notifyUser("Blocked!", `${domain} sent to GitHub.`);
    } else {
        const txt = await response.text();
        console.error("GitHub Request Failed:", txt);
        notifyUser("Failed", `GitHub API: ${response.status}`);
    }
  } catch (error) {
    console.error("Fetch/Network Error:", error);
    notifyUser("Network Error", error.message);
  }
}

function notifyUser(title, message) {
  console.log(`[Notification] ${title}: ${message}`);
  // Minimal notification options to avoid errors with missing icons or unsupported types
  chrome.notifications.create({
    type: "basic",
    title: title,
    message: message,
    iconUrl: "icon48.png", // Ensure this file exists, otherwise notifications fail
    priority: 2
  }, (id) => {
      if (chrome.runtime.lastError) {
          console.error("Notification failed:", chrome.runtime.lastError);
      } else {
          console.log("Notification sent, ID:", id);
      }
  });
}
