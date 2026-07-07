async function getPublicRedirect() {
  // Use a known file ID of a large file (>100MB) from the previous list
  const fileId = "1wdw89iU12iVJcNVxgtLvfMne-3JHa97c"; // Resurrection.2025.1080p (4.7 GB)
  
  const driveUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const res = await fetch(driveUrl);
  const html = await res.text();
  
  console.log("Response status:", res.status);
  
  // Search for confirm token in the HTML
  // Usually it looks like: name="confirm" value="xxxx"
  // or confirm=xxxx
  const match = html.match(/confirm=([a-zA-Z0-9_\\-]+)/);
  const match2 = html.match(/name="confirm"\s+value="([a-zA-Z0-9_\\-]+)"/);
  
  console.log("Regex match 1 (confirm=):", match ? match[1] : null);
  console.log("Regex match 2 (name/value):", match2 ? match2[1] : null);
  
  if (match || match2) {
    const token = (match ? match[1] : match2?.[1]) || "";
    const finalUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${token}`;
    console.log("Generated Direct Link:", finalUrl);
  } else {
    console.log("Confirm token not found. HTML snippet:");
    console.log(html.slice(0, 1000));
  }
}

getPublicRedirect().catch(console.error);
