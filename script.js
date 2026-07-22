(function () {
  var track = document.querySelector(".marquee-track");
  var speed = 70; // pixels per second — change this to speed up/slow down the whole marquee

  // real measured distance for one full loop: the track holds several identical
  // copies of the text back to back, so half its total width is exactly
  // how far it needs to shift to land back on an identical-looking frame.
  var loopDistance = track.scrollWidth / 2;
  var loopDuration = (loopDistance / speed) * 1000;

  track.closest(".marquee").style.visibility = "visible";

  track.animate(
    [
      { transform: "translateX(0px)" },
      { transform: "translateX(-" + loopDistance + "px)" },
    ],
    { duration: loopDuration, easing: "linear", iterations: Infinity }
  );
})();

(function () {
  var previewImage = document.getElementById("previewImage");
  var contentLayout = document.querySelector(".content-layout");
  if (!previewImage || !contentLayout) return;

  var links = document.querySelectorAll(".work-link");
  var logo = document.querySelector(".logo");
  var activeLink = null;
  var activeOpenEl = null;

  // a project's own title toggles its <li> (drives the description text
  // and the title's triangle); a WATCH link toggles only its own sublink
  // row (drives just that row's triangle) — the two stay independent so
  // opening one doesn't reveal or flip the other.
  function openItemFor(link) {
    var el = link.classList.contains("work-link")
      ? link.closest(".work-item")
      : link.closest(".work-sublink-row");
    if (activeOpenEl && activeOpenEl !== el) {
      activeOpenEl.classList.remove("is-open");
    }
    activeOpenEl = el;
    if (activeOpenEl) activeOpenEl.classList.add("is-open");
  }

  function closePreview() {
    contentLayout.classList.remove("is-active");
    activeLink = null;
    if (activeOpenEl) activeOpenEl.classList.remove("is-open");
    activeOpenEl = null;
    // wait for the pane's fade/collapse transition to finish before
    // swapping its content, so the text change doesn't happen mid-shrink
    setTimeout(function () {
      previewImage.classList.add("is-empty");
      previewImage.style.backgroundColor = "";
      previewImage.textContent = "Click a project";
    }, 300);
  }

  links.forEach(function (link) {
    link.addEventListener("click", function (event) {
      var images = link.dataset.previewImages;
      var pdf = link.dataset.previewPdf;
      var color = link.dataset.previewColor;
      var label = link.dataset.previewLabel;
      if (!images && !pdf && !color) return;

      event.preventDefault();

      if (activeLink === link) {
        closePreview();
        return;
      }
      activeLink = link;
      openItemFor(link);

      contentLayout.classList.add("is-active");
      previewImage.scrollTop = 0;

      if (images) {
        previewImage.classList.remove("is-empty");
        previewImage.style.backgroundColor = "";
        previewImage.innerHTML = "";
        images.split("|").forEach(function (src) {
          var img = document.createElement("img");
          img.loading = "lazy";
          img.src = src.trim();
          img.alt = label || "";
          previewImage.appendChild(img);
        });
      } else if (pdf) {
        previewImage.classList.remove("is-empty");
        previewImage.style.backgroundColor = "";
        previewImage.innerHTML = "";
        var pdfFrame = document.createElement("iframe");
        pdfFrame.className = "pdf-frame";
        pdfFrame.src = pdf;
        pdfFrame.title = label || "";
        previewImage.appendChild(pdfFrame);
      } else {
        previewImage.classList.add("is-empty");
        previewImage.innerHTML = "";
        previewImage.style.backgroundColor = color;
        previewImage.textContent = label || "";
      }
    });
  });

  var videoLinks = document.querySelectorAll("[data-preview-video]");

  videoLinks.forEach(function (link) {
    link.addEventListener("click", function (event) {
      var videoId = link.dataset.previewVideo;
      var start = link.dataset.previewVideoStart;
      var label = link.dataset.previewLabel;
      if (!videoId) return;

      event.preventDefault();

      if (activeLink === link) {
        closePreview();
        return;
      }
      activeLink = link;
      openItemFor(link);

      contentLayout.classList.add("is-active");
      previewImage.scrollTop = 0;
      previewImage.classList.remove("is-empty");
      previewImage.style.backgroundColor = "";
      previewImage.innerHTML = "";

      var iframe = document.createElement("iframe");
      var src = "https://www.youtube.com/embed/" + videoId;
      if (start) src += "?start=" + start;
      iframe.src = src;
      iframe.title = label || "";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.allowFullscreen = true;
      previewImage.appendChild(iframe);
    });
  });

  var videoFileLinks = document.querySelectorAll("[data-preview-video-file]");

  videoFileLinks.forEach(function (link) {
    link.addEventListener("click", function (event) {
      var src = link.dataset.previewVideoFile;
      var label = link.dataset.previewLabel;
      if (!src) return;

      event.preventDefault();

      if (activeLink === link) {
        closePreview();
        return;
      }
      activeLink = link;
      openItemFor(link);

      contentLayout.classList.add("is-active");
      previewImage.scrollTop = 0;
      previewImage.classList.remove("is-empty");
      previewImage.style.backgroundColor = "";
      previewImage.innerHTML = "";

      var video = document.createElement("video");
      video.src = src;
      video.controls = true;
      video.setAttribute("aria-label", label || "");
      previewImage.appendChild(video);
    });
  });

  if (logo) {
    logo.addEventListener("click", closePreview);
  }

  var lightbox = document.getElementById("lightbox");
  var lightboxImage = document.getElementById("lightboxImage");
  var lightboxPrev = document.getElementById("lightboxPrev");
  var lightboxNext = document.getElementById("lightboxNext");

  if (lightbox && lightboxImage) {
    var galleryImages = [];
    var galleryIndex = 0;

    function showLightboxImage(index) {
      galleryIndex = (index + galleryImages.length) % galleryImages.length;
      var img = galleryImages[galleryIndex];
      lightboxImage.src = img.src;
      lightboxImage.alt = img.alt;
    }

    function closeLightbox() {
      lightbox.classList.remove("is-open");
      lightboxImage.src = "";
    }

    previewImage.addEventListener("click", function (event) {
      if (event.target.tagName !== "IMG") return;
      galleryImages = Array.prototype.slice.call(previewImage.querySelectorAll("img"));
      showLightboxImage(galleryImages.indexOf(event.target));
      lightbox.classList.add("is-open");
    });

    lightbox.addEventListener("click", function (event) {
      if (event.target === lightboxImage || event.target === lightboxPrev || event.target === lightboxNext) return;
      closeLightbox();
    });

    lightboxPrev.addEventListener("click", function () {
      showLightboxImage(galleryIndex - 1);
    });

    lightboxNext.addEventListener("click", function () {
      showLightboxImage(galleryIndex + 1);
    });

    document.addEventListener("keydown", function (event) {
      if (!lightbox.classList.contains("is-open")) return;
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") showLightboxImage(galleryIndex - 1);
      if (event.key === "ArrowRight") showLightboxImage(galleryIndex + 1);
    });
  }
})();
