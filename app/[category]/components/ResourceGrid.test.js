import React from 'react';
import { render, screen } from '@testing-library/react';
import ResourceGrid from './ResourceGrid';

// Mock dependencies with the exact path alias used in ResourceGrid.js
jest.mock('react-window', () => ({
  List: jest.fn(({ rowCount, rowComponent: RowComponent, rowProps }) => {
    const renderedRows = [];
    for (let index = 0; index < rowCount; index++) {
      const style = { top: index * 100, height: 100 };
      renderedRows.push(
        <div key={index} data-testid={`row-${index}`}>
          <RowComponent index={index} style={style} {...rowProps} />
        </div>
      );
    }
    return (
      <div data-testid="virtualized-list" data-rowcount={rowCount}>
        {renderedRows}
      </div>
    );
  })
}));

jest.mock('react-virtualized-auto-sizer', () => {
  return {
    AutoSizer: ({ renderProp }) => {
      return renderProp({ height: 800, width: 1200 });
    }
  };
});

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  })
}));

jest.mock('@/app/components/ui/FolderCard', () => {
  return function DummyFolderCard({ folder, index }) {
    return <div data-testid={`folder-card-${folder.id}`} data-index={index}>Folder: {folder.name}</div>;
  };
});

jest.mock('@/app/components/ui/SoundButton', () => {
  return function DummySoundButton({ sound, index, isHighlighted }) {
    return (
      <div 
        data-testid={`sound-button-${sound.id}`} 
        data-index={index} 
        data-highlighted={isHighlighted ? 'true' : 'false'}
      >
        Sound: {sound.name}
      </div>
    );
  };
});

jest.mock('@/app/components/ui/ResourceCard', () => {
  return function DummyResourceCard({ resource, index, isHighlighted }) {
    return (
      <div 
        data-testid={`resource-card-${resource.id}`} 
        data-index={index} 
        data-highlighted={isHighlighted ? 'true' : 'false'}
      >
        Resource: {resource.name}
      </div>
    );
  };
});

jest.mock('../page.module.css', () => ({
  gridWrapper: 'gridWrapper',
  pluginGridWrapper: 'pluginGridWrapper',
  grid: 'grid',
  pluginGrid: 'pluginGrid',
  soundGrid: 'soundGrid',
  pluginSoundGrid: 'pluginSoundGrid',
  empty: 'empty',
  infiniteLoader: 'infiniteLoader',
  loaderIcon: 'loaderIcon'
}));

const mockInfo = {
  layout: 'video', // 'video' layout uses ResourceCard
  color: '#ff0000'
};

const mockFolders = [
  { id: 'f1', name: 'Subfolder 1', slug: 'subfolder-1' },
  { id: 'f2', name: 'Subfolder 2', slug: 'subfolder-2' }
];

const mockResources = [
  { id: 'r1', name: 'Resource 1', slug: 'resource-1', fileFormat: 'mp4' },
  { id: 'r2', name: 'Resource 2', slug: 'resource-2', fileFormat: 'mp4' },
  { id: 'r3', name: 'Resource 3', slug: 'resource-3', fileFormat: 'mp4' }
];

describe('ResourceGrid Ginned Sorting and Highlight Logic', () => {
  it('renders folders first then resources in normal state', () => {
    render(
      <ResourceGrid
        slug="video-effects"
        info={mockInfo}
        currentSubfolders={mockFolders}
        filteredResources={mockResources}
        isInitialLoading={false}
        isFetchLoading={false}
        isPending={false}
        highlightSlug={null}
        selectedFolderId={null}
      />
    );

    // With 1200 width and getColumnCount returning 4, we have:
    // flatItems = [f1, f2, r1, r2, r3] (length 5)
    // Row 0 has f1, f2, r1, r2. Row 1 has r3.
    const f1Card = screen.getByTestId('folder-card-f1');
    const f2Card = screen.getByTestId('folder-card-f2');
    const r1Card = screen.getByTestId('resource-card-r1');
    const r2Card = screen.getByTestId('resource-card-r2');
    const r3Card = screen.getByTestId('resource-card-r3');

    expect(f1Card).toBeInTheDocument();
    expect(f2Card).toBeInTheDocument();
    expect(r1Card).toBeInTheDocument();
    
    // Check indexing to confirm normal order
    // Folder 1 at index 0, Folder 2 at index 1, Resource 1 at index 2
    expect(f1Card.getAttribute('data-index')).toBe('0');
    expect(f2Card.getAttribute('data-index')).toBe('1');
    expect(r1Card.getAttribute('data-index')).toBe('2');
    expect(r2Card.getAttribute('data-index')).toBe('3');
    expect(r3Card.getAttribute('data-index')).toBe('4');
  });

  it('gins highlighted item at index 0 when highlightSlug is passed', () => {
    render(
      <ResourceGrid
        slug="video-effects"
        info={mockInfo}
        currentSubfolders={mockFolders}
        filteredResources={mockResources}
        isInitialLoading={false}
        isFetchLoading={false}
        isPending={false}
        highlightSlug="resource-2"
        selectedFolderId={null}
      />
    );

    // resource-2 should be at index 0 and highlighted
    const r2Card = screen.getByTestId('resource-card-r2');
    expect(r2Card.getAttribute('data-index')).toBe('0');
    expect(r2Card.getAttribute('data-highlighted')).toBe('true');

    // Folder 1 and 2 shift to index 1 and 2
    const f1Card = screen.getByTestId('folder-card-f1');
    const f2Card = screen.getByTestId('folder-card-f2');
    expect(f1Card.getAttribute('data-index')).toBe('1');
    expect(f2Card.getAttribute('data-index')).toBe('2');

    // resource-1 and resource-3 shift to index 3 and 4
    const r1Card = screen.getByTestId('resource-card-r1');
    const r3Card = screen.getByTestId('resource-card-r3');
    expect(r1Card.getAttribute('data-index')).toBe('3');
    expect(r3Card.getAttribute('data-index')).toBe('4');
  });

  it('keeps the highlighted item ginned at index 0 but turns off highlight glow when highlightSlug becomes null', () => {
    const { rerender } = render(
      <ResourceGrid
        slug="video-effects"
        info={mockInfo}
        currentSubfolders={mockFolders}
        filteredResources={mockResources}
        isInitialLoading={false}
        isFetchLoading={false}
        isPending={false}
        highlightSlug="resource-2"
        selectedFolderId={null}
      />
    );

    // Initial check: resource-2 is ginned and highlighted
    let r2Card = screen.getByTestId('resource-card-r2');
    expect(r2Card.getAttribute('data-index')).toBe('0');
    expect(r2Card.getAttribute('data-highlighted')).toBe('true');

    // Rerender with highlightSlug=null, simulating parameter being cleared after 2.5s
    // selectedFolderId remains null (no folder change)
    rerender(
      <ResourceGrid
        slug="video-effects"
        info={mockInfo}
        currentSubfolders={mockFolders}
        filteredResources={mockResources}
        isInitialLoading={false}
        isFetchLoading={false}
        isPending={false}
        highlightSlug={null}
        selectedFolderId={null}
      />
    );

    // Verify: resource-2 stays at index 0 (no Layout Shift)
    r2Card = screen.getByTestId('resource-card-r2');
    expect(r2Card.getAttribute('data-index')).toBe('0');
    
    // Verify: highlight glow is turned off
    expect(r2Card.getAttribute('data-highlighted')).toBe('false');

    // Verify other indexes stay shifted
    const f1Card = screen.getByTestId('folder-card-f1');
    expect(f1Card.getAttribute('data-index')).toBe('1');
  });

  it('clears activeHighlightSlug and returns normal order when selectedFolderId changes', () => {
    const { rerender } = render(
      <ResourceGrid
        slug="video-effects"
        info={mockInfo}
        currentSubfolders={mockFolders}
        filteredResources={mockResources}
        isInitialLoading={false}
        isFetchLoading={false}
        isPending={false}
        highlightSlug="resource-2"
        selectedFolderId="folder-root"
      />
    );

    // Verify ginned at 0
    let r2Card = screen.getByTestId('resource-card-r2');
    expect(r2Card.getAttribute('data-index')).toBe('0');

    // Rerender with highlightSlug=null AND selectedFolderId changing (user selected another folder)
    rerender(
      <ResourceGrid
        slug="video-effects"
        info={mockInfo}
        currentSubfolders={mockFolders}
        filteredResources={mockResources}
        isInitialLoading={false}
        isFetchLoading={false}
        isPending={false}
        highlightSlug={null}
        selectedFolderId="folder-child-1"
      />
    );

    // Verify: resource-2 returns to its normal index (index 3)
    r2Card = screen.getByTestId('resource-card-r2');
    expect(r2Card.getAttribute('data-index')).toBe('3');

    // Folder 1 goes back to index 0
    const f1Card = screen.getByTestId('folder-card-f1');
    expect(f1Card.getAttribute('data-index')).toBe('0');
  });

  it('clears activeHighlightSlug and returns normal order when category slug changes', () => {
    const { rerender } = render(
      <ResourceGrid
        slug="video-effects"
        info={mockInfo}
        currentSubfolders={mockFolders}
        filteredResources={mockResources}
        isInitialLoading={false}
        isFetchLoading={false}
        isPending={false}
        highlightSlug="resource-2"
        selectedFolderId="folder-root"
      />
    );

    // Verify ginned at 0
    let r2Card = screen.getByTestId('resource-card-r2');
    expect(r2Card.getAttribute('data-index')).toBe('0');

    // Rerender with highlightSlug=null AND category slug changing (user selected another category)
    rerender(
      <ResourceGrid
        slug="sound-effects"
        info={mockInfo}
        currentSubfolders={mockFolders}
        filteredResources={mockResources}
        isInitialLoading={false}
        isFetchLoading={false}
        isPending={false}
        highlightSlug={null}
        selectedFolderId="folder-root"
      />
    );

    // Verify: resource-2 returns to its normal index (index 3)
    r2Card = screen.getByTestId('resource-card-r2');
    expect(r2Card.getAttribute('data-index')).toBe('3');

    // Folder 1 goes back to index 0
    const f1Card = screen.getByTestId('folder-card-f1');
    expect(f1Card.getAttribute('data-index')).toBe('0');
  });
});
