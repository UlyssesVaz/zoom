// Graph Visualization using D3.js

let svg, simulation, currentData = null;

document.addEventListener('DOMContentLoaded', async function() {
  // Initialize graph service
  await window.graphService.initialize();
  
  // Setup D3 visualization
  setupGraph();
  
  // Load initial graph
  await loadGraph();
});

function setupGraph() {
  svg = d3.select('#graph-svg');
  
  // Clear any existing content
  svg.selectAll('*').remove();
  
  // Setup zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      svg.select('g').attr('transform', event.transform);
    });
  
  svg.call(zoom);
  
  // Create container group
  const container = svg.append('g');
  
  // Create simulation
  simulation = d3.forceSimulation()
    .force('link', d3.forceLink().id(d => d.id).distance(100))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(0, 0))
    .force('collision', d3.forceCollide().radius(30));
  
  // Store container reference
  svg._container = container;
}

async function loadGraph(filters = {}) {
  const data = window.graphService.getGraphData(filters);
  currentData = data;
  
  renderGraph(data);
}

function renderGraph(data) {
  const container = svg.select('g');
  const { nodes, edges } = data;
  
  // Clear existing
  container.selectAll('.link').remove();
  container.selectAll('.node').remove();
  
  // Create links
  const link = container.append('g')
    .selectAll('line')
    .data(edges)
    .enter()
    .append('line')
    .attr('class', d => `link ${d.type}`)
    .attr('stroke-width', d => {
      if (d.type === 'reports_to' || d.type === 'decision_maker_for') return 3;
      return 2;
    })
    .attr('opacity', d => d.strength || 0.6);
  
  // Create nodes
  const node = container.append('g')
    .selectAll('circle')
    .data(nodes)
    .enter()
    .append('circle')
    .attr('class', d => `node ${d.type}`)
    .attr('r', d => {
      if (d.type === 'contact') {
        // Size based on influence score
        return 10 + (d.influenceScore || 0) / 5;
      } else if (d.type === 'account') {
        return 15;
      } else {
        return 12;
      }
    })
    .attr('fill', d => {
      if (d.type === 'contact') return '#667eea';
      if (d.type === 'account') return '#10b981';
      if (d.type === 'deal') return '#f59e0b';
      return '#6b7280';
    })
    .call(drag(simulation));
  
  // Add labels
  const labels = container.append('g')
    .selectAll('text')
    .data(nodes)
    .enter()
    .append('text')
    .attr('class', 'node-label')
    .text(d => {
      if (d.type === 'contact') return d.name.split(' ')[0]; // First name
      return d.name;
    })
    .attr('dx', d => {
      if (d.type === 'contact') return 15;
      if (d.type === 'account') return 18;
      return 15;
    })
    .attr('dy', 4);
  
  // Add tooltips
  node.on('mouseover', function(event, d) {
    showTooltip(event, d);
  })
  .on('mousemove', function(event) {
    updateTooltipPosition(event);
  })
  .on('mouseout', function() {
    hideTooltip();
  })
  .on('click', function(event, d) {
    selectNode(d);
  });
  
  // Update simulation
  simulation.nodes(nodes);
  simulation.force('link').links(edges);
  simulation.alpha(1).restart();
  
  // Update positions on tick
  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);
    
    node
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);
    
    labels
      .attr('x', d => d.x)
      .attr('y', d => d.y);
  });
}

function drag(simulation) {
  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }
  
  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }
  
  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }
  
  return d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);
}

function showTooltip(event, node) {
  const tooltip = document.getElementById('node-tooltip');
  
  let content = `<strong>${node.name}</strong><br>`;
  
  if (node.type === 'contact') {
    content += `${node.title || ''}<br>`;
    content += `${node.company || ''}<br>`;
    content += `Influence: ${node.influenceScore || 0}/100<br>`;
    if (node.email) {
      content += `<small>${node.email}</small>`;
    }
  } else if (node.type === 'account') {
    content += `${node.industry || ''}<br>`;
    content += `${node.size || ''}`;
  } else if (node.type === 'deal') {
    content += `Value: $${(node.value || 0).toLocaleString()}<br>`;
    content += `Stage: ${node.stage || ''}`;
  }
  
  tooltip.innerHTML = content;
  tooltip.style.display = 'block';
  updateTooltipPosition(event);
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('node-tooltip');
  const rect = tooltip.parentElement.getBoundingClientRect();
  
  tooltip.style.left = (event.clientX - rect.left + 10) + 'px';
  tooltip.style.top = (event.clientY - rect.top - 10) + 'px';
}

function hideTooltip() {
  document.getElementById('node-tooltip').style.display = 'none';
}

function selectNode(node) {
  // Highlight selected node and its connections
  const connectedNodeIds = new Set([node.id]);
  
  currentData.edges.forEach(edge => {
    if (edge.source === node.id || edge.target === node.id) {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    }
  });
  
  // Update visualization to highlight connections
  svg.selectAll('.node')
    .attr('opacity', d => connectedNodeIds.has(d.id) ? 1 : 0.3);
  
  svg.selectAll('.link')
    .attr('opacity', d => 
      (connectedNodeIds.has(d.source.id) && connectedNodeIds.has(d.target.id)) ? 0.8 : 0.1
    );
  
  // Show node details (could open sidebar or modal)
  console.log('Selected node:', node);
}

function filterGraph() {
  const accountId = document.getElementById('account-filter').value;
  const dealId = document.getElementById('deal-filter').value;
  const minInfluence = parseInt(document.getElementById('influence-filter').value) || 0;
  
  const filters = {};
  if (accountId) filters.accountId = accountId;
  if (dealId) filters.dealId = dealId;
  if (minInfluence > 0) filters.minInfluence = minInfluence;
  
  loadGraph(filters);
}

function resetGraph() {
  document.getElementById('account-filter').value = '';
  document.getElementById('deal-filter').value = '';
  document.getElementById('influence-filter').value = '0';
  
  // Reset node opacity
  svg.selectAll('.node').attr('opacity', 1);
  svg.selectAll('.link').attr('opacity', d => d.strength || 0.6);
  
  loadGraph();
}





