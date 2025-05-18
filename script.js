const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = document.querySelector("#file-input");
const fileWrapper = promptForm.querySelector(".file-upload-wrapper");
const deleteChatButton = document.querySelector("#delete-chat-btn");
const themeToggleBtn = document.querySelector("#toggle-theme-btn");

const GEMINI_API_URL = `https://gemini-chatbot-server.vercel.app/`;

let typingInterval, controller;
let userData = { message: "", file: {} };
let chatHistory = [];

// Auto-scroll to bottom after every response
const scrollToBottom = () => {
  chatsContainer.scrollTo({
    top: chatsContainer.scrollHeight,
    behavior: "smooth",
  });
};

// Simulate typing Effect for model response
const typingEffect = (responseText, textElement, parentDiv) => {
  textElement.textContent = "";
  const words = responseText.split(" ");
  let wordIndex = 0;

  // Set an interval to type each word
  typingInterval = setInterval(() => {
    if (wordIndex < words.length) {
      parentDiv.classList.remove("loading");
      textElement.textContent +=
        (wordIndex === 0 ? "" : " ") + words[wordIndex++];
      scrollToBottom();
    } else {
      clearInterval(typingInterval);
      promptForm
        .querySelector(".prompt-actions")
        .classList.remove("bot-responding");
    }
  }, 90);
};

// Make API call and geneerate the bot's response
const generateResponse = async (botMsgDiv) => {
  // create text element in bot's div
  const textElement = botMsgDiv.querySelector(".message-text");
  controller = new AbortController();

  chatHistory.push({
    role: "user",
    parts: [
      {
        text: userData.message,
      },
      ...(userData.file.data
        ? [
            {
              inline_data: (({ fileName, isImage, ...rest }) => rest)(
                userData.file
              ),
            },
          ]
        : []),
    ],
  });

  try {
    // Send the chat history to the API to get a response
    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: chatHistory }),
      signal: controller.signal,
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error.message);

    // Process the response text and display it
    const botResponseText = data.reply.candidates[0].content.parts[0].text
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)/g, "- $1")
      .replace(/\*([^*]+)\*/g, "$1")
      .trim();

    typingEffect(botResponseText, textElement, botMsgDiv);
    chatHistory.push({ role: "model", parts: [{ text: botResponseText }] });

    // console.log(chatHistory);
  } catch (error) {
    textElement.style.color = "#d62939";
    textElement.textContent =
      error.name === "AbortError"
        ? "Response generation stopped"
        : error.message;
    botMsgDiv.classList.remove("loading");
    promptForm
      .querySelector(".prompt-actions")
      .classList.remove("bot-responding");
    scrollToBottom();
  } finally {
    userData.file = {};
    fileWrapper.querySelector(".image-preview").src = "";
  }
};

// method to create new message element
const createMsgElement = function (content, classNames) {
  const div = document.createElement("div");
  div.classList.add("message", ...classNames);
  div.innerHTML = content;
  return div;
};

// Handle form submission
const handlePromptForm = (e) => {
  e.preventDefault();
  container.classList.add("chat-on");
  const userMessage = promptInput.value.trim();
  if (
    !userMessage ||
    promptForm
      .querySelector(".prompt-actions")
      .classList.contains("bot-responding")
  )
    return;

  promptInput.value = "";
  userData.message = userMessage;
  fileWrapper.classList.remove("active", "img-attached", "file-attached");

  // creating user-message in the chats-container
  const userMsgHTML = `<p class="message-text"></p> 
  ${
    userData.file.data
      ? userData.file.isImage
        ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="img-attachment" />`
        : `<p class="file-attachment"><span class="material-symbols-rounded">description</span>${userData.file.fileName}</p>`
      : ""
  }`;
  const userMsgDiv = createMsgElement(userMsgHTML, ["user-message"]);

  userMsgDiv.querySelector(".message-text").textContent = userMessage;
  chatsContainer.appendChild(userMsgDiv);
  scrollToBottom();

  // bot responds
  setTimeout(() => {
    // creating bot-message in the chats-container
    const botMsgHTML =
      '<img class="bot-avatar" src="assets/images/gemini-logo.svg" alt="bot avatar image" /><p class="message-text">Just a sec...</p>';
    const botMsgDiv = createMsgElement(botMsgHTML, ["bot-message", "loading"]);

    chatsContainer.appendChild(botMsgDiv);
    scrollToBottom();

    // bot-responding class added
    promptForm.querySelector(".prompt-actions").classList.add("bot-responding");
    generateResponse(botMsgDiv);
  }, 600);
};

// handle file upload
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];

  if (!file) return console.log("no file selected");

  const isImage = file.type.startsWith("image/");

  // converting imagefile to url
  const reader = new FileReader();
  reader.readAsDataURL(file);

  reader.onload = (e) => {
    fileInput.value = "";
    const base64String = e.target.result.split(",")[1];
    fileWrapper.querySelector(".image-preview").src = e.target.result;
    fileWrapper.classList.add(
      "active",
      isImage ? "img-attached" : "file-attached"
    );

    // Store file data in userData obj
    userData.file = {
      fileName: file.name,
      data: base64String,
      mime_type: file.type,
      isImage,
    };
  };
});

promptForm.addEventListener("submit", handlePromptForm);
promptForm.querySelector("#add-file-btn").addEventListener("click", () => {
  fileInput.click();
});

// cancel the file upload
promptForm.querySelector("#cancel-file-btn").addEventListener("click", () => {
  userData.file = {};
  fileWrapper.classList.remove("active", "img-attached", "file-attached");
});

// stopping the bot response
promptForm.querySelector("#stop-response-btn").addEventListener("click", () => {
  userData.file = {};
  controller?.abort();
  clearInterval(typingInterval);
  promptForm
    .querySelector(".prompt-actions")
    .classList.remove("bot-responding");
});

// theme toggle light/dark theme
themeToggleBtn.addEventListener("click", () => {
  const isLightTheme = document.body.classList.toggle("light-theme");
  localStorage.setItem(
    "themeColor",
    isLightTheme ? "light-theme" : "dark-theme"
  );
  themeToggleBtn.textContent = isLightTheme ? "dark_mode" : "light_mode";
});

// delete all chats
deleteChatButton.addEventListener("click", () => {
  chatHistory = [];
  chatsContainer.textContent = "";
  container.classList.remove("chat-on");
});

// Handle suggestions click
document.querySelectorAll(".suggested-item").forEach((item) => {
  item.addEventListener("click", () => {
    promptInput.value = item.querySelector(".text").textContent;
    promptForm.dispatchEvent(new Event("submit"));
    container.classList.add("chat-on");
    scrollToBottom();
  });
});

// set initial theme from local-Storage
const isLightTheme = localStorage.getItem("themeColor") === "light-theme";
document.body.classList.toggle("light-theme", isLightTheme);
themeToggleBtn.textContent = isLightTheme ? "dark_mode" : "light_mode";
