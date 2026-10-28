import{bu as n,j as e,bv as m,bw as d,bx as p,T as i,by as u,B as l,bz as b,bA as x}from"./iframe-BjN4PNZi.js";import{i as h,D as c}from"./fixtures-CW67wZDI.js";import{L as g,C as f}from"./list-B-g-f-Xg.js";import{S as j}from"./sliders-horizontal-DnySrMd3.js";import"./preload-helper-PPVm8Dsz.js";import"./circle-dashed-Divtlg0F.js";import"./signal-high-Dzb6_NUQ.js";import"./tag-D81nTkkR.js";import"./settings-ULeVwmos.js";import"./user-plus-DQ5D-oOB.js";import"./inbox-CXA9en-m.js";import"./layers-syhRhF9-.js";import"./copy-DjBACZ_m.js";const z={title:"Patterns/AppShell",component:n,tags:["autodocs"],parameters:{layout:"fullscreen",docs:{description:{component:"The app frame: a collapsible sidebar (workspace switcher, Inbox / My issues / Views, your\nteams, help) and an inset main panel with a top bar. Press `[` to collapse the sidebar to\nicons (tooltips show the names); below 768px it becomes a drawer opened from the top bar.\n\nCompose it from `Sidebar`, `SidebarHeader`, `SidebarWorkspaceSwitcher`, `SidebarContent`,\n`SidebarSection`, `SidebarItem`, `SidebarTeam`, `SidebarFooter`, and `AppTopBar` with\n`AppBreadcrumb` and `ViewSwitch`. `useAppShell()` reads and drives the sidebar state."}}},args:{defaultCollapsed:!1,sidebar:e.jsx(c,{}),children:null},argTypes:{sidebar:{control:!1},children:{control:!1}}};function S(){return e.jsx(d,{title:e.jsx(p,{items:[e.jsxs(e.Fragment,{children:[e.jsx(x,{name:"Engineering"}),"Engineering"]}),"Active issues"]}),actions:e.jsxs(e.Fragment,{children:[e.jsx(u,{options:[{value:"list",label:"List",icon:e.jsx(g,{})},{value:"board",label:"Board",icon:e.jsx(f,{})}]}),e.jsx(l,{variant:"ghost",size:"sm",icon:e.jsx(b,{}),children:"Filter"}),e.jsx(l,{variant:"secondary",size:"sm",icon:e.jsx(j,{}),children:"Display"})]})})}const s={render:o=>e.jsxs(n,{...o,children:[e.jsx(S,{}),e.jsx("div",{className:"min-h-0 flex-1 overflow-y-auto",children:e.jsx(m,{issues:h})})]})},a={args:{defaultCollapsed:!0},render:s.render},t={render:o=>e.jsxs(n,{...o,sidebar:e.jsx(c,{active:"inbox"}),children:[e.jsx(d,{title:e.jsx(p,{items:["Inbox"]})}),e.jsxs("div",{className:"flex flex-1 flex-col items-center justify-center gap-1",children:[e.jsx(i,{weight:"medium",children:"You're all caught up"}),e.jsx(i,{tone:"subtle",children:"New mentions, assignments and replies land here."})]})]})},r={globals:{viewport:{value:"mobile1",isRotated:!1}},render:s.render},D=["Playground","Collapsed","EmptyPage","Mobile"];s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  render: args => <AppShell {...args}>
      <TopBar />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <IssueList issues={issues} />
      </div>
    </AppShell>
}`,...s.parameters?.docs?.source}}};a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  args: {
    defaultCollapsed: true
  },
  render: Playground.render
}`,...a.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  render: args => <AppShell {...args} sidebar={<DemoSidebar active="inbox" />}>
      <AppTopBar title={<AppBreadcrumb items={["Inbox"]} />} />
      <div className="flex flex-1 flex-col items-center justify-center gap-1">
        <Text weight="medium">You're all caught up</Text>
        <Text tone="subtle">
          New mentions, assignments and replies land here.
        </Text>
      </div>
    </AppShell>
}`,...t.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  globals: {
    viewport: {
      value: "mobile1",
      isRotated: false
    }
  },
  render: Playground.render
}`,...r.parameters?.docs?.source},description:{story:"Below 768px the sidebar is a drawer: use the button at the top left.",...r.parameters?.docs?.description}}};export{a as Collapsed,t as EmptyPage,r as Mobile,s as Playground,D as __namedExportsOrder,z as default};
