/**
 * Aynı Wi-Fi'deki telefon/tablet için bağlantı adreslerini gösterir.
 */
export async function renderNetworkInfo(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  try {
    const res = await fetch("/api/server-info");
    if (!res.ok) return;
    const data = await res.json();

    const hosts = data.hosts || [];
    const isLocal =
      location.hostname === "localhost" || location.hostname === "127.0.0.1";
    const onLan = hosts.some((url) => {
      try {
        return new URL(url).hostname === location.hostname;
      } catch {
        return false;
      }
    });

    if (hosts.length === 0) {
      el.innerHTML = `
        <p><strong>Telefon bağlantısı</strong></p>
        <p>Wi-Fi IP bulunamadı. Bilgisayarda <code>ipconfig</code> ile IPv4 adresinize bakın, sonra telefonda <code>http://ADRES:3000</code> yazın.</p>
      `;
      el.classList.remove("hidden");
      return;
    }

    const links = hosts
      .map(
        (url) =>
          `<li><a href="${url}" class="network-link">${url}</a></li>`
      )
      .join("");

    let extra = "";
    if (isLocal) {
      extra = `<p class="network-hint">Bu sayfayı telefonda açmak için yukarıdaki <strong>192.168…</strong> adresine dokunun. <code>localhost</code> telefonda çalışmaz.</p>`;
    } else if (onLan) {
      extra = `<p class="network-hint">Bu cihaz sunucuya bağlı. Diğer cihazlar aynı adresi kullanabilir.</p>`;
    }

    el.innerHTML = `
      <p><strong>Telefon / tablet adresi</strong> (aynı Wi-Fi)</p>
      <ul class="network-list">${links}</ul>
      ${extra}
    `;
    el.classList.remove("hidden");
  } catch {
    /* sunucu kapalı */
  }
}
