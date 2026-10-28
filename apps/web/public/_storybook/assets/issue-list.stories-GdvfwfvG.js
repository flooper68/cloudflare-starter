import{bv as i,j as s,bG as l,r as m}from"./iframe-BjN4PNZi.js";import{i as r}from"./fixtures-CW67wZDI.js";import"./preload-helper-PPVm8Dsz.js";import"./circle-dashed-Divtlg0F.js";import"./signal-high-Dzb6_NUQ.js";import"./tag-D81nTkkR.js";import"./settings-ULeVwmos.js";import"./user-plus-DQ5D-oOB.js";import"./inbox-CXA9en-m.js";import"./layers-syhRhF9-.js";import"./copy-DjBACZ_m.js";const k={title:"Patterns/IssueList",component:i,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:`Linear's dense issue list, grouped by status. Click a priority or status glyph to change
it. Select with the checkbox (shown on hover), ⌘-click or Shift-click; with the list
focused use ↑/↓ (or j/k) to move, \`x\` to select, Shift+↑/↓ to extend, Enter to open and
Escape to clear the selection.`}}},args:{issues:r,showEmptyGroups:!1,onIssueOpen:()=>{},onAddIssue:()=>{}}};function g(e){const[p,x]=m.useState(r),[c,h]=m.useState(e.defaultSelectedIds??[]);return s.jsxs("div",{className:"flex h-dvh flex-col bg-surface",children:[s.jsx("div",{className:"flex h-9 items-center border-b border-line px-4 text-xs text-fg-subtle",children:c.length>0?`${c.length} selected`:`${p.length} issues`}),s.jsx("div",{className:"min-h-0 flex-1 overflow-y-auto",children:s.jsx(i,{...e,issues:p,selectedIds:c,onSelectedIdsChange:h,onIssueChange:(f,I)=>x(S=>S.map(d=>d.id===f?{...d,...I}:d))})})]})}const o={render:e=>s.jsx(g,{onIssueOpen:e.onIssueOpen,onAddIssue:e.onAddIssue,showEmptyGroups:e.showEmptyGroups})},a={render:()=>s.jsx(g,{defaultSelectedIds:["i-142","i-155","i-160"]})},n={args:{showEmptyGroups:!0,issues:r.slice(0,4)},render:e=>s.jsx("div",{className:"bg-surface",children:s.jsx(i,{...e})})},u={args:{issues:[]},render:e=>s.jsx("div",{className:"bg-surface",children:s.jsx(i,{...e})})},t={parameters:{layout:"padded"},render:()=>{const e=r[0];return s.jsxs("div",{className:"max-w-3xl rounded-lg border border-line bg-surface",children:[s.jsx(l,{issue:e}),s.jsx(l,{issue:r[2],selected:!0}),s.jsx(l,{issue:r[6],active:!0})]})}},L=["Playground","WithSelection","EmptyGroups","Empty","SingleRow"];o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: args => <Stateful onIssueOpen={args.onIssueOpen} onAddIssue={args.onAddIssue} showEmptyGroups={args.showEmptyGroups} />
}`,...o.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  render: () => <Stateful defaultSelectedIds={["i-142", "i-155", "i-160"]} />
}`,...a.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    showEmptyGroups: true,
    issues: fixtureIssues.slice(0, 4)
  },
  render: args => <div className="bg-surface">
      <IssueList {...args} />
    </div>
}`,...n.parameters?.docs?.source}}};u.parameters={...u.parameters,docs:{...u.parameters?.docs,source:{originalSource:`{
  args: {
    issues: []
  },
  render: args => <div className="bg-surface">
      <IssueList {...args} />
    </div>
}`,...u.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  parameters: {
    layout: "padded"
  },
  render: () => {
    const issue = fixtureIssues[0] as Issue;
    return <div className="max-w-3xl rounded-lg border border-line bg-surface">
        <IssueRow issue={issue} />
        <IssueRow issue={fixtureIssues[2] as Issue} selected />
        <IssueRow issue={fixtureIssues[6] as Issue} active />
      </div>;
  }
}`,...t.parameters?.docs?.source},description:{story:"A single row, e.g. for search results or a related-issues list.",...t.parameters?.docs?.description}}};export{u as Empty,n as EmptyGroups,o as Playground,t as SingleRow,a as WithSelection,L as __namedExportsOrder,k as default};
