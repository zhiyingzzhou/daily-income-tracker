import React, { useEffect, useState } from 'react';

interface FloatingSaveButtonProps {
  hasChanges: boolean;
  onSave: () => void;
  isSaving?: boolean;
  isSaved?: boolean;
  shortcut?: string;
}

export const FloatingSaveButton: React.FC<FloatingSaveButtonProps> = ({
  hasChanges,
  onSave,
  isSaving = false,
  isSaved = false,
  shortcut = 'Ctrl+S',
}) => {
  const [visible, setVisible] = useState(false);
  const [animationClass, setAnimationClass] = useState('');

  // 更新按钮可见性逻辑
  useEffect(() => {
    // 有变更时显示按钮
    if (hasChanges && !visible) {
      setVisible(true);
      setAnimationClass('floating-save-enter');
      setTimeout(() => setAnimationClass(''), 400);
    }
    // 没有变更且不在保存状态时隐藏按钮
    else if (!hasChanges && visible && !isSaving) {
      // 如果刚刚保存成功，等待"已保存"状态显示一会后再隐藏
      const hideDelay = isSaved ? 1500 : 300;
      setTimeout(() => {
        if (!hasChanges) {
          // 再次检查，以防在延迟期间状态发生变化
          setAnimationClass('floating-save-exit');
          setTimeout(() => {
            setVisible(false);
            setAnimationClass('');
          }, 300);
        }
      }, hideDelay);
    }
  }, [hasChanges, visible, isSaving, isSaved]);

  // 保存成功反馈
  useEffect(() => {
    if (isSaved) {
      setAnimationClass('floating-save-success');
      setTimeout(() => {
        if (visible) {
          // 仅在按钮仍然可见时重置动画
          setAnimationClass('');
        }
      }, 1500);
    }
  }, [isSaved, visible]);

  // 键盘快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's' && hasChanges) {
        e.preventDefault();
        onSave();
      }
    };

    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
    return () => {};
  }, [visible, hasChanges, onSave]);

  if (!visible) return null;

  const getButtonText = () => {
    if (isSaving) return '保存中...';
    if (isSaved) return '已保存';
    return '保存设置';
  };

  const getButtonIcon = () => {
    if (isSaving) return '⏳';
    if (isSaved) return '✅';
    return '💾';
  };

  const buttonClasses = [
    'floating-save-button',
    animationClass,
    isSaved ? 'saved' : '',
    isSaving ? 'saving' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="floating-save-container">
      <button
        className={buttonClasses}
        onClick={onSave}
        disabled={isSaving || isSaved || !hasChanges}
        aria-label={getButtonText()}
      >
        {/* 变更指示器 */}
        {hasChanges && !isSaved && !isSaving && <div className="floating-save-indicator" />}

        {/* 快捷键提示 */}
        <div className="floating-save-shortcut">{shortcut}</div>

        {/* 按钮内容 */}
        <span className="floating-save-button-icon">{getButtonIcon()}</span>
        <span className="floating-save-button-text">{getButtonText()}</span>
      </button>
    </div>
  );
};
