console.log("Service Worker Loaded");

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension Installed/Updated");
  chrome.contextMenus.create({
    id: "block-domain",
    title: "Block Domain (Pi-hole)",
    contexts: ["image", "frame", "link", "page"]
  }, () => {
    if (chrome.runtime.lastError) {
      console.error("Context menu creation error:", chrome.runtime.lastError.message);
    } else {
      console.log("Context menu created successfully");
    }
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log("Context menu clicked:", info);

  if (info.menuItemId === "block-domain") {
    let targetUrl = info.srcUrl || info.frameUrl || info.linkUrl || info.pageUrl;
    console.log("Target URL identified:", targetUrl);

    if (!targetUrl) {
      console.error("No target URL found");
      notifyUser("Error", "Could not determine URL to block.");
      return;
    }

    try {
      const url = new URL(targetUrl);
      const domain = url.hostname;
      console.log("Parsed Domain:", domain);
      triggerGitHubAction(domain);
    } catch (e) {
      console.error("URL parsing error:", e);
      notifyUser("Error", "Invalid URL: " + targetUrl);
    }
  }
});

async function triggerGitHubAction(domain) {
  console.log("Triggering GitHub Action for:", domain);
  try {
    const data = await chrome.storage.sync.get(["githubUser", "githubRepo", "githubPat"]);
    console.log("Storage data retrieved:", { user: data.githubUser, repo: data.githubRepo, pat: data.githubPat ? "***" : "missing" });

    const { githubUser, githubRepo, githubPat } = data;

    if (!githubUser || !githubRepo || !githubPat) {
      console.error("Missing credentials");
      notifyUser("Configuration Error", "Please set GitHub credentials in extension options.");
      chrome.runtime.openOptionsPage();
      return;
    }

    const apiUrl = `https://api.github.com/repos/${githubUser}/${githubRepo}/dispatches`;
    console.log("Sending request to:", apiUrl);
    
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

    console.log("Response status:", response.status);
    
    if (response.ok) {
      console.log("Request successful");
      notifyUser("Success", `Sent request to block: ${domain}`);
    } else {
      const errorText = await response.text();
      console.error("GitHub API Error:", response.status, errorText);
      notifyUser("API Error", `Failed: ${response.status}. See Console.`);
    }
  } catch (error) {
    console.error("Network/Script Error:", error);
    notifyUser("Network Error", `Failed: ${error.message}`);
  }
}

function notifyUser(title, message) {
  console.log("Attempting notification:", title, message);
  const options = {
    type: "basic",
    title: title,
    message: message,
    iconUrl: "icon48.png"
  };
  
  chrome.notifications.create(options, (notificationId) => {
    if (chrome.runtime.lastError) {
      console.error("Notification Error:", chrome.runtime.lastError.message);
    } else {
      console.log("Notification created ID:", notificationId);
    }
  });
}
