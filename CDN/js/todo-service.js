/**
 * Todo/Task Service
 * 
 * Centralized task management for sales teams
 * Aggregates action items from:
 * - Call debriefs (next steps)
 * - Deal activities
 * - Manual tasks
 * - CRM tasks
 */

class TodoService {
  constructor() {
    this.tasks = this.loadTasks();
    this.listeners = [];
  }

  /**
   * Load tasks from localStorage
   */
  loadTasks() {
    try {
      const stored = localStorage.getItem('celera_tasks');
      const tasks = stored ? JSON.parse(stored) : [];
      
      // Ensure all tasks have state property (migration for old tasks)
      return tasks.map(task => {
        if (!task.state) {
          task.state = task.completed ? 'done' : 'not_started';
        }
        return task;
      });
    } catch (e) {
      console.error('Failed to load tasks:', e);
      return [];
    }
  }

  /**
   * Save tasks to localStorage
   */
  saveTasks() {
    try {
      localStorage.setItem('celera_tasks', JSON.stringify(this.tasks));
      this.notifyListeners();
    } catch (e) {
      console.error('Failed to save tasks:', e);
    }
  }

  /**
   * Get all tasks
   * @param {Object} filters - Filter options
   * @returns {Array} Array of tasks
   */
  getTasks(filters = {}) {
    let tasks = [...this.tasks];

    // Filter by status
    if (filters.status !== undefined) {
      tasks = tasks.filter(t => t.completed === filters.status);
    }

    // Filter by deal
    if (filters.dealId) {
      tasks = tasks.filter(t => t.dealId === filters.dealId);
    }

    // Filter by due date
    if (filters.overdue) {
      const now = new Date();
      tasks = tasks.filter(t => 
        !t.completed && 
        t.dueDate && 
        new Date(t.dueDate) < now
      );
    }

    // Filter by today
    if (filters.today) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      tasks = tasks.filter(t => {
        if (!t.dueDate) return false;
        const dueDate = new Date(t.dueDate);
        return dueDate >= today && dueDate < tomorrow;
      });
    }

    // Sort: incomplete first, then by due date
    tasks.sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate) - new Date(b.dueDate);
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return tasks;
  }

  /**
   * Create a new task
   * @param {Object} taskData - Task data
   * @returns {Object} Created task
   */
  createTask(taskData) {
    const task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: taskData.title || '',
      description: taskData.description || '',
      dealId: taskData.dealId || null,
      dealName: taskData.dealName || null,
      contactId: taskData.contactId || null,
      contactName: taskData.contactName || null,
      dueDate: taskData.dueDate || null,
      priority: taskData.priority || 'medium', // low, medium, high
      state: taskData.state || 'not_started', // not_started, in_progress, done
      completed: taskData.completed !== undefined ? taskData.completed : false, // Keep for backward compatibility
      completedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: taskData.source || 'manual', // manual, call, crm, email
      sourceId: taskData.sourceId || null, // ID of the source (e.g., call ID)
      metadata: taskData.metadata || {}
    };

    // Sync completed state with state
    if (task.state === 'done') {
      task.completed = true;
      task.completedAt = new Date().toISOString();
    } else if (task.completed && task.state !== 'done') {
      task.state = 'done';
    }

    this.tasks.push(task);
    this.saveTasks();
    return task;
  }

  /**
   * Create tasks from next steps (from call debrief)
   * @param {Array} nextSteps - Array of next step strings
   * @param {Object} context - Context (deal, call, etc.)
   * @returns {Array} Created tasks
   */
  createTasksFromNextSteps(nextSteps, context = {}) {
    if (!nextSteps || nextSteps.length === 0) {
      return [];
    }

    const tasks = nextSteps.map((step, index) => {
      // Try to extract due date from step text (e.g., "Follow up by Friday")
      let dueDate = null;
      const datePatterns = [
        /(?:by|before|on)\s+(\w+\s+\d{1,2})/i,
        /(?:due|deadline)\s+(\w+\s+\d{1,2})/i,
        /(\d{1,2}\/\d{1,2}\/\d{4})/,
        /(\d{1,2}-\d{1,2}-\d{4})/
      ];

      for (const pattern of datePatterns) {
        const match = step.match(pattern);
        if (match) {
          // Simple date parsing (could be improved)
          try {
            dueDate = new Date(match[1]).toISOString();
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }

      // Default: set due date to 3 days from now if not specified
      if (!dueDate) {
        const defaultDue = new Date();
        defaultDue.setDate(defaultDue.getDate() + 3);
        dueDate = defaultDue.toISOString();
      }

      return this.createTask({
        title: step,
        dealId: context.dealId || null,
        dealName: context.dealName || null,
        contactId: context.contactId || null,
        contactName: context.contactName || null,
        dueDate: dueDate,
        priority: context.priority || 'medium',
        source: 'call',
        sourceId: context.callId || null,
        metadata: {
          callDate: context.callDate || null,
          callDuration: context.callDuration || null,
          participants: context.participants || []
        }
      });
    });

    return tasks;
  }

  /**
   * Update a task
   * @param {string} taskId - Task ID
   * @param {Object} updates - Updates to apply
   * @returns {Object|null} Updated task
   */
  updateTask(taskId, updates) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) {
      return null;
    }

    Object.assign(task, updates, {
      updatedAt: new Date().toISOString()
    });

    // Sync state with completed
    if (updates.state !== undefined) {
      if (updates.state === 'done') {
        task.completed = true;
        if (!task.completedAt) {
          task.completedAt = new Date().toISOString();
        }
      } else {
        task.completed = false;
        task.completedAt = null;
      }
    }

    // If marking as completed, set state and completedAt
    if (updates.completed && !task.completed) {
      task.state = 'done';
      task.completedAt = new Date().toISOString();
    }

    // If uncompleting, clear completedAt and set state
    if (updates.completed === false && task.completed) {
      task.state = 'not_started';
      task.completedAt = null;
    }

    this.saveTasks();
    return task;
  }

  /**
   * Delete a task
   * @param {string} taskId - Task ID
   * @returns {boolean} Success
   */
  deleteTask(taskId) {
    const index = this.tasks.findIndex(t => t.id === taskId);
    if (index === -1) {
      return false;
    }

    this.tasks.splice(index, 1);
    this.saveTasks();
    return true;
  }

  /**
   * Toggle task completion
   * @param {string} taskId - Task ID
   * @returns {Object|null} Updated task
   */
  toggleTask(taskId) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) {
      return null;
    }

    // Cycle through states: not_started -> in_progress -> done -> not_started
    let newState = 'not_started';
    if (task.state === 'not_started') {
      newState = 'in_progress';
    } else if (task.state === 'in_progress') {
      newState = 'done';
    }

    return this.updateTask(taskId, {
      state: newState,
      completed: newState === 'done'
    });
  }

  /**
   * Move task to specific state
   */
  moveTaskToState(taskId, state) {
    return this.updateTask(taskId, {
      state: state,
      completed: state === 'done'
    });
  }

  /**
   * Get tasks grouped by call/source
   */
  getTasksGroupedByCall() {
    const groups = {};
    
    this.tasks.forEach(task => {
      const callId = task.metadata?.callId || task.sourceId || (task.source === 'call' ? task.sourceId : 'manual');
      
      if (!groups[callId]) {
        groups[callId] = {
          callId: callId,
          callDate: task.metadata?.callDate || task.createdAt,
          dealName: task.dealName || (callId === 'manual' ? 'Manual Tasks' : 'Other'),
          tasks: []
        };
      }
      
      groups[callId].tasks.push(task);
    });

    // Sort groups by call date (most recent first)
    return Object.values(groups).sort((a, b) => 
      new Date(b.callDate) - new Date(a.callDate)
    );
  }

  /**
   * Get task statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const allTasks = this.getTasks();
    const incomplete = allTasks.filter(t => !t.completed);
    const overdue = incomplete.filter(t => {
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < now;
    });
    const dueToday = incomplete.filter(t => {
      if (!t.dueDate) return false;
      const dueDate = new Date(t.dueDate);
      return dueDate >= today && dueDate < tomorrow;
    });
    const highPriority = incomplete.filter(t => t.priority === 'high');

    return {
      total: allTasks.length,
      completed: allTasks.filter(t => t.completed).length,
      incomplete: incomplete.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      highPriority: highPriority.length
    };
  }

  /**
   * Subscribe to task updates
   * @param {Function} callback - Callback function
   */
  subscribe(callback) {
    this.listeners.push(callback);
  }

  /**
   * Unsubscribe from task updates
   * @param {Function} callback - Callback function
   */
  unsubscribe(callback) {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notify listeners of changes
   */
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.tasks);
      } catch (e) {
        console.error('Error in task listener:', e);
      }
    });
  }

  /**
   * Get tasks for a specific deal
   * @param {string} dealId - Deal ID
   * @returns {Array} Tasks for the deal
   */
  getDealTasks(dealId) {
    return this.getTasks({ dealId, status: false });
  }

  /**
   * Bulk create tasks
   * @param {Array} tasksData - Array of task data objects
   * @returns {Array} Created tasks
   */
  bulkCreateTasks(tasksData) {
    const tasks = tasksData.map(data => this.createTask(data));
    return tasks;
  }
}

// Export singleton instance
window.todoService = new TodoService();

