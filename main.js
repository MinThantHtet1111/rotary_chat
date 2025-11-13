/* ------------------------------------------------------------
 *  Copilot Studio Agent – Direct Line API Web Chat Connector
 * ------------------------------------------------------------
 */

import { DirectLine } from "botframework-directlinejs";

/* ------------------------------------------------------------
 *  1.  Direct Line Configuration
 * ------------------------------------------------------------
 *  Get this Direct Line Secret or Token from Copilot Studio:
 *  - Go to your Agent > Channels > Add a Channel > Direct Line
 * ------------------------------------------------------------
 */
const settings = {
  directLineSecret: "", // replace this
};

let directLine;

/* ------------------------------------------------------------
 *  2.  Simple DOM helper
 * ------------------------------------------------------------
 */
function add(cls, text) {
  const div = Object.assign(document.createElement("div"), {
    className: cls,
    textContent: text
  });
  document.getElementById("messages").appendChild(div);
  div.scrollIntoView();
}

/* ------------------------------------------------------------
 *  3.  Connect to Direct Line
 * ------------------------------------------------------------
 */
function startConversation() {
  if (!settings.directLineSecret) {
    console.error("No Direct Line secret configured. Check VITE_DIRECT_LINE_SECRET.");
    alert("Direct Line secret is not configured.");
    return;
  }
  directLine = new DirectLine({
    secret: settings.directLineSecret,
  });

  // When a message is received from the bot
  directLine.activity$.subscribe(activity => {
    if (activity.type === "message" && activity.from.id !== "user") {
      add("bot", activity.text);
    }
  });

  document.getElementById("signin").style.display = "none";
  document.getElementById("chatArea").style.display = "block";
  add("sys", "Connected to Copilot Studio agent via Direct Line!");
}

/* ------------------------------------------------------------
 *  4.  Send message to bot
 * ------------------------------------------------------------
 */
function sendMessage() {
  const box = document.getElementById("userInput");
  const text = box.value.trim();
  if (!text) return;

  add("you", text);
  box.value = "";

  directLine.postActivity({
    from: { id: "user", name: "User" },
    type: "message",
    text
  }).subscribe(
    id => console.log("Sent message ID: ", id),
    err => console.error("Error sending message: ", err)
  );
}

/* ------------------------------------------------------------
 *  5.  Hook up buttons
 * ------------------------------------------------------------
 */
document.getElementById("signin").addEventListener("click", startConversation);
document.getElementById("send").addEventListener("click", sendMessage);
