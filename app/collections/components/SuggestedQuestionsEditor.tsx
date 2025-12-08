"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  GripVertical,
  Plus,
  Trash2,
  MessageCircleQuestion,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SuggestedQuestionsEditorProps {
  questions: string[]
  onChange: (questions: string[]) => void
  maxQuestions?: number
}

interface SortableQuestionItemProps {
  id: string
  index: number
  question: string
  onUpdate: (index: number, value: string) => void
  onDelete: (index: number) => void
}

function SortableQuestionItem({
  id,
  index,
  question,
  onUpdate,
  onDelete,
}: SortableQuestionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-2 rounded-md border bg-background group",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="touch-none cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Question number */}
      <Badge variant="outline" className="shrink-0 w-6 h-6 p-0 flex items-center justify-center text-xs">
        {index + 1}
      </Badge>

      {/* Question input */}
      <Input
        value={question}
        onChange={(e) => onUpdate(index, e.target.value)}
        placeholder="추천 질문을 입력하세요..."
        className="flex-1 h-8 text-sm"
      />

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(index)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function SuggestedQuestionsEditor({
  questions,
  onChange,
  maxQuestions = 10,
}: SuggestedQuestionsEditorProps) {
  const [newQuestion, setNewQuestion] = useState("")

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Generate unique IDs for sortable items
  const itemIds = questions.map((_, index) => `question-${index}`)

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = itemIds.indexOf(active.id as string)
      const newIndex = itemIds.indexOf(over.id as string)
      onChange(arrayMove(questions, oldIndex, newIndex))
    }
  }

  // Update question
  const updateQuestion = (index: number, value: string) => {
    const updated = [...questions]
    updated[index] = value
    onChange(updated)
  }

  // Delete question
  const deleteQuestion = (index: number) => {
    onChange(questions.filter((_, i) => i !== index))
  }

  // Add new question
  const addQuestion = () => {
    if (newQuestion.trim() && questions.length < maxQuestions) {
      onChange([...questions, newQuestion.trim()])
      setNewQuestion("")
    }
  }

  // Handle Enter key in new question input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && newQuestion.trim()) {
      e.preventDefault()
      addQuestion()
    }
  }

  return (
    <div className="space-y-3">
      {/* Question list with drag and drop */}
      {questions.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={itemIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {questions.map((question, index) => (
                <SortableQuestionItem
                  key={itemIds[index]}
                  id={itemIds[index]}
                  index={index}
                  question={question}
                  onUpdate={updateQuestion}
                  onDelete={deleteQuestion}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="flex flex-col items-center justify-center py-6 text-center border rounded-md border-dashed">
          <MessageCircleQuestion className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            추천 질문이 없습니다. 아래에서 추가하세요.
          </p>
        </div>
      )}

      {/* Add new question */}
      {questions.length < maxQuestions && (
        <div className="flex items-center gap-2">
          <Input
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="새 추천 질문 입력..."
            className="flex-1 h-9"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={addQuestion}
            disabled={!newQuestion.trim()}
            className="shrink-0"
          >
            <Plus className="h-4 w-4 mr-1" />
            추가
          </Button>
        </div>
      )}

      {/* Info */}
      <p className="text-xs text-muted-foreground">
        {questions.length}/{maxQuestions}개 질문 | 드래그하여 순서 변경
      </p>
    </div>
  )
}
