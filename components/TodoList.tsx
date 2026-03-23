'use client'

import React, { useState } from 'react'
import { useTimeBoxStore } from '@/lib/store'
import { generateBlockId } from '@/lib/id'

export default function TodoList() {
  const [inputText, setInputText] = useState('')
  const { todoItems, addTodoItem, toggleTodoItem, deleteTodoItem, clearCompletedTodos } = useTimeBoxStore()

  const completedCount = todoItems.filter((item) => item.completed).length

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputText.trim()) {
      addTodoItem({
        id: generateBlockId(),
        text: inputText.trim(),
        completed: false,
      })
      setInputText('')
    }
  }

  return (
    <div className="bg-card rounded-lg shadow-md p-4">
      <h3 className="font-semibold text-card-foreground mb-3">To-Do List</h3>

      {todoItems.length > 0 && (
        <ul className="space-y-1 mb-3">
          {todoItems.map((item) => (
            <li
              key={item.id}
              className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-accent"
            >
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => toggleTodoItem(item.id)}
                className="h-4 w-4 rounded border-input text-primary focus:ring-ring cursor-pointer"
              />
              <span
                className={`flex-1 text-sm ${
                  item.completed ? 'line-through text-muted-foreground' : 'text-foreground'
                }`}
              >
                {item.text}
              </span>
              <button
                onClick={() => deleteTodoItem(item.id)}
                className="text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none"
                aria-label={`Delete ${item.text}`}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        type="text"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a to-do..."
        className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
      />

      {completedCount > 0 && (
        <button
          onClick={clearCompletedTodos}
          className="mt-2 text-xs text-primary hover:text-primary/80"
        >
          Clear completed ({completedCount})
        </button>
      )}
    </div>
  )
}
