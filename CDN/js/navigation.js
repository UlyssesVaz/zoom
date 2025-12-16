// Celera Navigation

document.addEventListener('DOMContentLoaded', function() {
  // Set active nav item based on current page
  const currentPath = window.location.pathname;
  
  // Handle expandable submenu groups
  const navGroups = document.querySelectorAll('.sidebar-nav-group-header');
  navGroups.forEach(header => {
    // Check if this group should be expanded (has active child)
    const submenu = header.nextElementSibling;
    if (submenu) {
      const activeChild = submenu.querySelector('.sidebar-nav-submenu-link.active');
      if (activeChild) {
        header.classList.add('expanded');
      }
    }
    
    header.addEventListener('click', function(e) {
      // Don't toggle if disabled
      if (this.classList.contains('disabled')) {
        return;
      }
      
      const submenu = this.nextElementSibling;
      if (submenu && submenu.classList.contains('sidebar-nav-submenu')) {
        const isExpanded = this.classList.contains('expanded');
        
        if (isExpanded) {
          this.classList.remove('expanded');
        } else {
          this.classList.add('expanded');
        }
      }
    });
  });
  
  // Set active nav items
  const navLinks = document.querySelectorAll('.sidebar-nav-link, .sidebar-nav-submenu-link');
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href && (currentPath === href || currentPath.startsWith(href + '/'))) {
      link.classList.add('active');
      
      // Expand parent group if it's a submenu item
      const parentGroup = link.closest('.sidebar-nav-group');
      if (parentGroup) {
        const groupHeader = parentGroup.querySelector('.sidebar-nav-group-header');
        if (groupHeader) {
          groupHeader.classList.add('expanded', 'active');
        }
      }
    }
  });
  
  // Handle collapsible sections (for content areas)
  const collapsibleHeaders = document.querySelectorAll('.collapsible-header');
  collapsibleHeaders.forEach(header => {
    header.addEventListener('click', function() {
      const content = this.nextElementSibling;
      if (!content || !content.classList.contains('collapsible-content')) {
        return;
      }
      
      const isOpen = content.classList.contains('open');
      
      // Toggle current section
      if (isOpen) {
        content.classList.remove('open');
        this.classList.remove('active');
      } else {
        content.classList.add('open');
        this.classList.add('active');
      }
    });
  });
  
  // Mobile sidebar toggle
  const sidebarToggle = document.querySelector('.sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', function() {
      sidebar.classList.toggle('open');
    });
  }
  
  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', function(e) {
    if (window.innerWidth <= 768) {
      if (sidebar && sidebarToggle && 
          !sidebar.contains(e.target) && 
          !sidebarToggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    }
  });
});

// Navigation structure - can be used to generate sidebar dynamically
window.celeraNavigation = {
  items: [
    {
      type: 'link',
      icon: '📊',
      label: 'Dashboard',
      href: '/dashboard.html',
      active: true
    },
    {
      type: 'group',
      icon: '💼',
      label: 'Sales & Leads',
      expanded: true,
      items: [
        {
          type: 'link',
          icon: '📋',
          label: 'Pipeline',
          href: '/sales/pipeline.html'
        },
        {
          type: 'link',
          icon: '🎯',
          label: 'Pre-Call Prep',
          href: '/prep.html'
        },
        {
          type: 'link',
          icon: '📞',
          label: 'Active Calls',
          href: '/sales/calls.html'
        },
        {
          type: 'link',
          icon: '📊',
          label: 'Call Summary',
          href: '/summary.html'
        }
      ]
    },
    {
      type: 'group',
      icon: '📈',
      label: 'Marketing',
      disabled: true,
      tooltip: 'Coming Soon',
      items: [
        {
          type: 'link',
          icon: '📢',
          label: 'Campaigns',
          href: '#',
          disabled: true
        },
        {
          type: 'link',
          icon: '📊',
          label: 'Ads Performance',
          href: '#',
          disabled: true
        },
        {
          type: 'link',
          icon: '🔗',
          label: 'Lead Sources',
          href: '#',
          disabled: true
        }
      ]
    },
    {
      type: 'group',
      icon: '🤖',
      label: 'AI Tools',
      items: [
        {
          type: 'link',
          icon: '🎭',
          label: 'Roleplay Practice',
          href: '/ai/roleplay.html'
        },
        {
          type: 'link',
          icon: '💡',
          label: 'Call Prep AI',
          href: '/ai/prep.html'
        },
        {
          type: 'link',
          icon: '🔍',
          label: 'Conversation Analysis',
          href: '/ai/analysis.html'
        }
      ]
    },
    {
      type: 'link',
      icon: '⚙️',
      label: 'Settings',
      href: '/settings.html'
    }
  ]
};
