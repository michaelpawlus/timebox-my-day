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
    <div className="bg-white rounded-lg shadow-md p-4">
      <h3 className="font-semibold text-gray-900 mb-3">To-Do List</h3>

      {todoItems.length > 0 && (
        <ul className="space-y-1 mb-3">
          {todoItems.map((item) => (
            <li
              key={item.id}
              className="group flex items-center gap-2 rounded px-1 py-1 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => toggleTodoItem(item.id)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span
                className={`flex-1 text-sm ${
                  item.completed ? 'line-through text-gray-400' : 'text-gray-700'
                }`}
              >
                {item.text}
              </span>
              <button
                onClick={() => deleteTodoItem(item.id)}
                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-lg leading-none"
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
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />

      {completedCount > 0 && (
        <button
          onClick={clearCompletedTodos}
          className="mt-2 text-xs text-blue-600 hover:text-blue-800"
        >
          Clear completed ({completedCount})
        </button>
      )}
    </div>
  )
}
