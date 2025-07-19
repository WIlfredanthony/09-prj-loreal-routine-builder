/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const generateRoutineBtn = document.getElementById("generateRoutine");
const selectedProductsList = document.getElementById("selectedProductsList");

/* Your Cloudflare Worker URL - replace with your actual worker URL */
const WORKER_URL = "https://wonderbot-worker.wilfredfajardo2020.workers.dev/";

/* Array to store selected products */
let selectedProducts = [];

/* Array to store conversation history for context */
let conversationHistory = [];

/* Array to store all products for filtering */
let allProducts = [];

/* Current filter state */
let currentCategory = "";
let currentSearchTerm = "";

/* Load selected products from localStorage on page load */
function loadSelectedProductsFromStorage() {
  const savedProducts = localStorage.getItem("selectedProducts");
  if (savedProducts) {
    selectedProducts = JSON.parse(savedProducts);
    updateSelectedProductsDisplay();
    /* Update the visual state of selected product cards */
    updateProductCardsVisualState();
  }
}

/* Save selected products to localStorage */
function saveSelectedProductsToStorage() {
  localStorage.setItem("selectedProducts", JSON.stringify(selectedProducts));
}

/* Update visual state of product cards based on selected products */
function updateProductCardsVisualState() {
  selectedProducts.forEach((selectedProduct) => {
    const productCard = document.querySelector(
      `[data-product-id="${selectedProduct.id}"]`
    );
    if (productCard) {
      productCard.classList.add("selected");
      const selectButton = productCard.querySelector(".select-product-btn");
      if (selectButton) {
        selectButton.innerHTML = '<i class="fa-solid fa-check"></i> Added';
        selectButton.disabled = true;
      }
    }
  });
}

/* Clear all selected products */
function clearAllSelectedProducts() {
  /* Clear the array */
  selectedProducts = [];

  /* Remove from localStorage */
  localStorage.removeItem("selectedProducts");

  /* Update the display */
  updateSelectedProductsDisplay();

  /* Update all product cards to show unselected state */
  const allProductCards = document.querySelectorAll(".product-card");
  allProductCards.forEach((card) => {
    card.classList.remove("selected");
    const selectButton = card.querySelector(".select-product-btn");
    if (selectButton) {
      selectButton.innerHTML =
        '<i class="fa-solid fa-plus"></i> Add to Routine';
      selectButton.disabled = false;
    }
  });

  /* Clear conversation history since routine is no longer valid */
  conversationHistory = [];
  chatWindow.innerHTML =
    "<p>All products cleared! Select some products to get started.</p>";
}

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  /* Only fetch if we haven't loaded products yet */
  if (allProducts.length === 0) {
    const response = await fetch("products.json");
    const data = await response.json();
    allProducts = data.products;
  }
  return allProducts;
}

/* Filter products based on category and search term */
function filterProducts() {
  let filteredProducts = allProducts;

  /* Apply category filter if selected */
  if (currentCategory) {
    filteredProducts = filteredProducts.filter(
      (product) => product.category === currentCategory
    );
  }

  /* Apply search filter if there's a search term */
  if (currentSearchTerm) {
    filteredProducts = filteredProducts.filter((product) => {
      /* Search in product name, brand, and description */
      const searchText = currentSearchTerm.toLowerCase();
      return (
        product.name.toLowerCase().includes(searchText) ||
        product.brand.toLowerCase().includes(searchText) ||
        product.description.toLowerCase().includes(searchText)
      );
    });
  }

  /* Display the filtered products */
  displayProducts(filteredProducts);

  /* Show helpful message if no products found */
  if (filteredProducts.length === 0) {
    productsContainer.innerHTML = `
      <div class="no-results-message">
        <i class="fa-solid fa-search"></i>
        <h3>No products found</h3>
        <p>Try adjusting your category or search terms</p>
        <button class="clear-filters-btn" onclick="clearAllFilters()">
          <i class="fa-solid fa-refresh"></i> Clear Filters
        </button>
      </div>
    `;
  }
}

/* Clear all filters and show initial state */
function clearAllFilters() {
  currentCategory = "";
  currentSearchTerm = "";
  categoryFilter.value = "";
  productSearch.value = "";

  productsContainer.innerHTML = `
    <div class="placeholder-message">
      Select a category to view products
    </div>
  `;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card" data-product-id="${product.id}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
        
        <!-- Toggle button for description -->
        <button class="description-toggle" aria-expanded="false" aria-controls="desc-${product.id}">
          <i class="fa-solid fa-info-circle"></i>
          Show Details
        </button>
        
        <!-- Hidden description section -->
        <div class="product-description" id="desc-${product.id}" hidden>
          <p>${product.description}</p>
        </div>
        
        <!-- Select product button -->
        <button class="select-product-btn" data-product-id="${product.id}">
          <i class="fa-solid fa-plus"></i>
          Add to Routine
        </button>
      </div>
    </div>
  `
    )
    .join("");

  /* Add click event listeners to all toggle buttons */
  const toggleButtons = document.querySelectorAll(".description-toggle");
  toggleButtons.forEach((button) => {
    button.addEventListener("click", toggleDescription);
  });

  /* Add click event listeners to all select product buttons */
  const selectButtons = document.querySelectorAll(".select-product-btn");
  selectButtons.forEach((button) => {
    button.addEventListener("click", selectProduct);
  });

  /* Update visual state for already selected products */
  updateProductCardsVisualState();
}

/* Handle product selection */
async function selectProduct(event) {
  const productId = event.currentTarget.getAttribute("data-product-id");
  const products = await loadProducts();
  const product = products.find((p) => p.id === parseInt(productId));

  /* Check if product is already selected */
  if (!selectedProducts.find((p) => p.id === product.id)) {
    selectedProducts.push(product);
    /* Save to localStorage */
    saveSelectedProductsToStorage();
    updateSelectedProductsDisplay();

    /* Update the button to show it's selected */
    const productCard = document.querySelector(
      `[data-product-id="${productId}"]`
    );
    productCard.classList.add("selected");

    const button = event.currentTarget;
    button.innerHTML = '<i class="fa-solid fa-check"></i> Added';
    button.disabled = true;
  }
}

/* Generate personalized routine using Cloudflare Worker with web search */
async function generatePersonalizedRoutine() {
  if (selectedProducts.length === 0) {
    chatWindow.innerHTML =
      "<p>Please select some products first to generate a routine!</p>";
    return;
  }

  /* Clear previous conversation and start fresh */
  conversationHistory = [];

  /* Check if we're in RTL mode */
  const isRTL = document.documentElement.getAttribute("dir") === "rtl";
  const loadingText = isRTL
    ? "جاري البحث وإنشاء روتينك الشخصي..."
    : "Searching for latest information and generating your personalized routine...";

  chatWindow.innerHTML = `
    <p class="loading-message">
      <i class="fa-solid fa-spinner fa-spin"></i> ${loadingText}
    </p>
  `;

  try {
    /* Prepare the product data for the API */
    const productData = selectedProducts.map((product) => ({
      name: product.name,
      brand: product.brand,
      category: product.category,
      description: product.description,
    }));

    /* Create the system message with RTL awareness and web search instructions */
    const systemContent = isRTL
      ? "أنت خبير في مجال التجميل والعناية بالبشرة لمنتجات لوريال. ابحث في الويب عن أحدث المعلومات حول المنتجات المختارة واستخدم هذه المعلومات لإنشاء روتين شخصي. قم بتضمين المصادر والروابط في إجابتك."
      : "You are a L'Oréal beauty and skincare expert. Search the web for the latest information about the selected products and use this current information to create personalized routines. Include sources and links in your response when available.";

    const systemMessage = {
      role: "system",
      content: systemContent,
    };

    const userContent = isRTL
      ? `ابحث في الويب عن أحدث المعلومات حول منتجات لوريال هذه ثم قم بإنشاء روتين شخصي للتجميل/العناية بالبشرة: ${JSON.stringify(
          productData
        )}. 

      يجب أن يتضمن:
      - معلومات محدثة عن كل منتج من البحث على الإنترنت
      - خطوات روتين الصباح (إن أمكن)
      - خطوات روتين المساء (إن أمكن)
      - ترتيب التطبيق المحدث
      - نصائح حديثة للحصول على أفضل النتائج
      - أي تحديثات أو معلومات جديدة حول المنتجات
      - المصادر والروابط للمعلومات المستخدمة
      
      قم بتنسيق الإجابة بطريقة واضحة وسهلة المتابعة.`
      : `Search the web for the latest information about these L'Oréal products and then create a personalized beauty/skincare routine: ${JSON.stringify(
          productData
        )}. 
      
      Include:
      - Updated information about each product from web search
      - Morning routine steps (if applicable)
      - Evening routine steps (if applicable)  
      - Current recommended order of application
      - Latest tips for best results
      - Any recent updates or new information about the products
      - Sources and links for the information used
      
      Format the response in a clear, easy-to-follow way with proper citations.`;

    const userMessage = {
      role: "user",
      content: userContent,
    };

    /* Add to conversation history */
    conversationHistory.push(systemMessage, userMessage);

    /* Send request to Cloudflare Worker with web search enabled */
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: conversationHistory,
        max_tokens: 1200 /* Increased for web search results */,
        temperature: 0.7,
        web_search: true /* Enable web search */,
        include_citations: true /* Request citations */,
      }),
    });

    const data = await response.json();

    if (data.choices && data.choices[0] && data.choices[0].message) {
      /* Add AI response to conversation history */
      conversationHistory.push(data.choices[0].message);

      /* Process the response to format citations and links */
      let formattedContent = data.choices[0].message.content;

      /* Format citations and links for better display */
      formattedContent = formatCitationsAndLinks(formattedContent);

      /* Display the AI-generated routine with RTL-aware title */
      const routineTitle = isRTL
        ? "روتينك الشخصي (محدث بأحدث المعلومات)"
        : "Your Personalized Routine (Updated with Latest Information)";
      const followUpText = isRTL
        ? "<strong>💬 هل لديك أسئلة حول روتينك المحدث؟</strong> اسألني أي شيء في المحادثة أدناه!"
        : "<strong>💬 Have questions about your updated routine?</strong> Ask me anything in the chat below!";

      chatWindow.innerHTML = `
        <h3>${routineTitle}</h3>
        <div class="routine-content">
          ${formattedContent.replace(/\n/g, "<br>")}
        </div>
        <div class="follow-up-prompt">
          <p>${followUpText}</p>
        </div>
      `;
    } else {
      const errorText = isRTL
        ? "عذراً، لم أتمكن من إنشاء روتين الآن. يرجى المحاولة مرة أخرى."
        : "Sorry, I couldn't generate a routine right now. Please try again.";
      chatWindow.innerHTML = `<p>${errorText}</p>`;
    }
  } catch (error) {
    console.error("Error generating routine:", error);
    const errorText = isRTL
      ? "عذراً، حدث خطأ أثناء إنشاء الروتين. يرجى المحاولة مرة أخرى."
      : "Sorry, there was an error generating your routine. Please try again.";
    chatWindow.innerHTML = `<p>${errorText}</p>`;
  }

  /* Scroll to bottom of chat */
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Function to format citations and links in the AI response */
function formatCitationsAndLinks(content) {
  /* Convert URL patterns to clickable links */
  content = content.replace(
    /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" class="citation-link">$1</a>'
  );

  /* Format citation patterns like [1], [2], etc. */
  content = content.replace(
    /\[(\d+)\]/g,
    '<span class="citation-number">[$1]</span>'
  );

  /* Format source indicators */
  content = content.replace(
    /Source:/gi,
    '<strong class="source-label">Source:</strong>'
  );

  /* Format L'Oréal product mentions to be more prominent */
  content = content.replace(
    /(L'Oréal|loreal)/gi,
    '<strong class="brand-highlight">L\'Oréal</strong>'
  );

  return content;
}

/* Chat form submission handler - now uses web search */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userInput = document.getElementById("userInput");
  const userMessage = userInput.value.trim();

  if (!userMessage) return;

  /* Check if we're in RTL mode for proper labeling */
  const isRTL = document.documentElement.getAttribute("dir") === "rtl";
  const youLabel = isRTL ? "أنت:" : "You:";
  const aiLabel = isRTL ? "المساعد الذكي:" : "AI Assistant:";
  const thinkingText = isRTL
    ? "المساعد الذكي يبحث ويفكر..."
    : "AI is searching and thinking...";

  /* Add user message to chat window */
  chatWindow.innerHTML += `
    <div class="chat-message user-message">
      <strong>${youLabel}</strong> ${userMessage}
    </div>
  `;

  /* Show loading indicator with web search context */
  chatWindow.innerHTML += `
    <div class="chat-message loading-message">
      <i class="fa-solid fa-spinner fa-spin"></i> ${thinkingText}
    </div>
  `;

  /* Clear the input */
  userInput.value = "";

  /* Scroll to bottom */
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    /* Create user message object */
    const newUserMessage = {
      role: "user",
      content: userMessage,
    };

    /* If no conversation history exists, start with system message */
    if (conversationHistory.length === 0) {
      const systemContent = isRTL
        ? "أنت مستشار مفيد في مجال التجميل والعناية بالبشرة لمنتجات لوريال. ابحث في الويب عن أحدث المعلومات لتقديم نصائح محدثة ودقيقة. قم بتضمين المصادر والروابط عندما تكون متاحة."
        : "You are a helpful L'Oréal beauty and skincare advisor. Search the web for the latest information to provide current and accurate advice. Include sources and links when available.";

      conversationHistory.push({
        role: "system",
        content: systemContent,
      });
    }

    /* Add user message to conversation history */
    conversationHistory.push(newUserMessage);

    /* Send message to Cloudflare Worker with web search enabled */
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: conversationHistory,
        max_tokens: 800 /* Increased for web search results */,
        temperature: 0.7,
        web_search: true /* Enable web search for follow-up questions */,
        include_citations: true /* Request citations */,
      }),
    });

    const data = await response.json();

    /* Remove loading message */
    const loadingMessage = chatWindow.querySelector(".loading-message");
    if (loadingMessage) {
      loadingMessage.remove();
    }

    if (data.choices && data.choices[0] && data.choices[0].message) {
      /* Add AI response to conversation history */
      conversationHistory.push(data.choices[0].message);

      /* Format the response content with citations and links */
      let formattedResponse = formatCitationsAndLinks(
        data.choices[0].message.content
      );

      /* Display the AI response with formatted citations */
      chatWindow.innerHTML += `
        <div class="chat-message ai-message">
          <strong>${aiLabel}</strong> ${formattedResponse}
        </div>
      `;
    } else {
      const errorText = isRTL
        ? "عذراً، لم أتمكن من معالجة رسالتك الآن. يرجى المحاولة مرة أخرى."
        : "Sorry, I couldn't process your message right now. Please try again.";

      chatWindow.innerHTML += `
        <div class="chat-message ai-message error">
          <strong>${aiLabel}</strong> ${errorText}
        </div>
      `;
    }
  } catch (error) {
    console.error("Error:", error);

    /* Remove loading message */
    const loadingMessage = chatWindow.querySelector(".loading-message");
    if (loadingMessage) {
      loadingMessage.remove();
    }

    const errorText = isRTL
      ? "عذراً، حدث خطأ. يرجى المحاولة مرة أخرى."
      : "Sorry, there was an error. Please try again.";

    chatWindow.innerHTML += `
      <div class="chat-message ai-message error">
        <strong>${aiLabel}</strong> ${errorText}
      </div>
    `;
  }

  /* Scroll to bottom of chat */
  chatWindow.scrollTop = chatWindow.scrollHeight;
});

/* Toggle product description visibility */
function toggleDescription(event) {
  const button = event.currentTarget;
  const icon = button.querySelector("i");
  const descriptionId = button.getAttribute("aria-controls");
  const description = document.getElementById(descriptionId);
  const isExpanded = button.getAttribute("aria-expanded") === "true";

  if (isExpanded) {
    /* Hide description */
    description.hidden = true;
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = '<i class="fa-solid fa-info-circle"></i> Show Details';
    button.classList.remove("expanded");
  } else {
    /* Show description */
    description.hidden = false;
    button.setAttribute("aria-expanded", "true");
    button.innerHTML = '<i class="fa-solid fa-chevron-up"></i> Hide Details';
    button.classList.add("expanded");
  }
}

/* Handle search input with real-time filtering */
function handleSearch(event) {
  currentSearchTerm = event.target.value.trim();

  /* If there's a search term but no category, show all products */
  if (currentSearchTerm && !currentCategory) {
    filterProducts();
  } else if (currentSearchTerm && currentCategory) {
    /* If there's both search and category, filter normally */
    filterProducts();
  } else if (!currentSearchTerm && currentCategory) {
    /* If search is cleared, show category results or placeholder */
    filterProducts();
  } else {
    /* If both are cleared, show placeholder */
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Select a category to view products
      </div>
    `;
  }
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  /* Load products if not already loaded */
  await loadProducts();

  currentCategory = e.target.value;
  filterProducts();
});

/* Add search functionality with debouncing for better performance */
let searchTimeout;
productSearch.addEventListener("input", async (e) => {
  /* Load products if not already loaded */
  await loadProducts();

  /* Clear previous timeout */
  clearTimeout(searchTimeout);

  /* Add small delay to avoid filtering on every keystroke */
  searchTimeout = setTimeout(() => {
    handleSearch(e);
  }, 300);
});

/* Initialize the app when page loads */
window.addEventListener("DOMContentLoaded", () => {
  /* Load selected products from localStorage */
  loadSelectedProductsFromStorage();

  /* Initialize selected products display */
  updateSelectedProductsDisplay();
});

/* Add event listener for Generate Routine button */
generateRoutineBtn.addEventListener("click", generatePersonalizedRoutine);
