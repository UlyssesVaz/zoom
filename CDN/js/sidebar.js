/**
 * Sidebar Navigation Generator
 * Generates sidebar HTML from navigation structure
 */

function generateSidebar() {
  const nav = window.celeraNavigation;
  if (!nav) return '';
  
  let html = `
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1>🎯 Celera</h1>
        <p>Sales Intelligence Platform</p>
      </div>
      <nav>
        <ul class="sidebar-nav">
  `;
  
  nav.items.forEach(item => {
    if (item.type === 'link') {
      const disabledClass = item.disabled ? ' disabled' : '';
      const activeClass = item.active ? ' active' : '';
      html += `
        <li class="sidebar-nav-item">
          <a href="${item.href}" class="sidebar-nav-link${disabledClass}${activeClass}" ${item.disabled ? 'title="' + (item.tooltip || 'Coming Soon') + '"' : ''}>
            <i>${item.icon}</i>
            <span>${item.label}</span>
          </a>
        </li>
      `;
    } else if (item.type === 'group') {
      const disabledClass = item.disabled ? ' disabled' : '';
      const expandedClass = item.expanded ? ' expanded' : '';
      const activeClass = item.active ? ' active' : '';
      
      html += `
        <li class="sidebar-nav-item">
          <div class="sidebar-nav-group">
            <div class="sidebar-nav-group-header${disabledClass}${expandedClass}${activeClass}" ${item.disabled ? 'title="' + (item.tooltip || 'Coming Soon') + '"' : ''}>
              <div class="sidebar-nav-group-title">
                <i>${item.icon}</i>
                <span>${item.label}</span>
              </div>
              <span class="sidebar-nav-group-icon">▶</span>
            </div>
            <ul class="sidebar-nav-submenu">
      `;
      
      item.items.forEach(subItem => {
        const subDisabledClass = subItem.disabled ? ' disabled' : '';
        const subActiveClass = subItem.active ? ' active' : '';
        html += `
          <li class="sidebar-nav-submenu-item">
            <a href="${subItem.href}" class="sidebar-nav-submenu-link${subDisabledClass}${subActiveClass}" ${subItem.disabled ? 'title="Coming Soon"' : ''}>
              <i>${subItem.icon}</i>
              <span>${subItem.label}</span>
            </a>
          </li>
        `;
      });
      
      html += `
            </ul>
          </div>
        </li>
      `;
    }
  });
  
  html += `
        </ul>
      </nav>
    </aside>
    <button class="sidebar-toggle">☰</button>
  `;
  
  return html;
}

// Auto-generate sidebar if container exists
document.addEventListener('DOMContentLoaded', function() {
  const sidebarContainer = document.getElementById('sidebar-container');
  if (sidebarContainer) {
    sidebarContainer.innerHTML = generateSidebar();
    // Re-initialize navigation after generating
    if (typeof window.celeraNavigation !== 'undefined') {
      // Navigation.js will handle the rest
    }
  }
});




