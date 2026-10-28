import{b5 as w,j as s,r as f,B as b,P as I,E as A,z as P,w as T,x as z,b6 as D,h as R,b7 as F,y as g,u as h,b8 as B}from"./iframe-BjN4PNZi.js";import{I as E}from"./inbox-CXA9en-m.js";import{A as L}from"./archive-vpGSa4fK.js";import"./preload-helper-PPVm8Dsz.js";const M=["Sync stalls when the device goes offline mid-upload","Keyboard shortcut for moving issues between cycles","Remove legacy webhooks v1 endpoints","Dark mode contrast on the roadmap timeline","Invite flow drops the workspace name in the email","Paginate the audit log API","Slack notification shows raw markdown","Add SAML just-in-time provisioning","Cycle burndown ignores issues moved mid-cycle","Rate limit GraphQL mutations per token","Duplicate detection for new bug reports","Project updates editor loses focus on paste","CSV import fails on UTF-16 files","Show estimate totals in the board column header","Migrate attachments to R2","Crash when opening an archived project","Customer request: export roadmap as PDF","Search does not match issue keys without dash","Bulk edit: set priority for 100+ issues times out","Reduce cold start of the sync worker","Triage inbox: snooze until next cycle","Mentions autocomplete lags in large teams","Billing page shows wrong seat count after downgrade","Mobile: swipe to archive notification","Document the public API rate limits","Two-factor recovery codes download","Sub-issue progress not shown on parent","GitHub PR link not detected in branch names with slashes","Timezone bug in due date reminders","Add Figma embed preview","Label groups: allow nesting one level","Speed up initial load of the issue list","Webhook retries should back off exponentially","Empty state for filtered views","Copy issue URL with title on ⌘⇧C","SCIM deprovisioning leaves sessions active","Roadmap zoom resets on navigation","Inline code formatting in comments","Support custom fields on projects","Activity feed groups consecutive edits"],x=["Ada Lovelace","Grace Hopper","Alan Turing","Katherine Johnson","Margaret Hamilton","Barbara Liskov"],n=[{name:"Bug",color:"danger"},{name:"Feature",color:"accent"},{name:"Improvement",color:"info"},{name:"Performance",color:"warning"},{name:"Design",color:"success"}],y=M.map((e,a)=>({id:`ENG-${412-a*7}`,title:e,status:h[a*5%h.length],priority:g[a*3%g.length],assignee:a%7===3?null:x[a%x.length],labels:a%4===0?[n[a%n.length],n[(a+2)%n.length]]:[n[a%n.length]],due:a%3===2?null:new Date(2026,10,1+a*11%45)})),O=e=>h.indexOf(e),G=e=>g.indexOf(e),t=B(),S=[t.accessor(e=>G(e.priority),{id:"priority",header:"Priority",meta:{label:"Priority",headerClassName:"w-20"},enableGlobalFilter:!1,cell:({row:e})=>s.jsx(A,{priority:e.original.priority,label:P[e.original.priority]})}),t.accessor("id",{header:"ID",meta:{cellClassName:"text-fg-muted tabular-nums whitespace-nowrap"}}),t.accessor(e=>O(e.status),{id:"status",header:"Status",enableGlobalFilter:!1,cell:({row:e})=>s.jsxs("span",{className:"flex items-center gap-2 whitespace-nowrap text-fg-muted",children:[s.jsx(z,{status:e.original.status,label:""}),T[e.original.status]]})}),t.accessor("title",{header:"Title",meta:{cellClassName:"max-w-0 w-full"},cell:({getValue:e})=>s.jsx("span",{className:"block truncate font-medium",children:e()})}),t.display({id:"labels",header:"Labels",cell:({row:e})=>s.jsx("span",{className:"flex gap-1",children:e.original.labels.map(a=>s.jsx(D,{size:"sm",color:a.color,children:a.name},a.name))})}),t.accessor(e=>e.assignee??"",{id:"assignee",header:"Assignee",cell:({row:e})=>e.original.assignee?s.jsxs("span",{className:"flex items-center gap-2 whitespace-nowrap text-fg-muted",children:[s.jsx(R,{name:e.original.assignee,size:"sm"}),e.original.assignee]}):s.jsx("span",{className:"text-fg-subtle",children:"Unassigned"})}),t.accessor(e=>e.due?.getTime()??Number.POSITIVE_INFINITY,{id:"due",header:"Due",enableGlobalFilter:!1,meta:{align:"right",cellClassName:"whitespace-nowrap text-fg-muted"},cell:({row:e})=>e.original.due?F(e.original.due,"MMM d"):"—"})],K={title:"Data display/DataTable",component:w,tags:["autodocs"],parameters:{layout:"padded",docs:{description:{component:`A full-featured table on TanStack Table 9. Click headers to sort (Shift-click to
multi-sort), tick rows (Shift-click for a range), filter with the search field, hide
columns from "View", and page through results. Columns are TanStack column
definitions built with \`createDataTableColumnHelper<Row>()\`.`}}},args:{data:y,columns:S,getRowId:e=>e.id,enableRowSelection:!0,enableGlobalFilter:!0,enableColumnVisibility:!0,pageSize:10,loading:!1,stickyHeader:!1,searchPlaceholder:"Filter issues…"}},i={},o={args:{loading:!0}},r={args:{data:[],emptyState:s.jsxs("span",{className:"flex flex-col items-center gap-1",children:[s.jsx(E,{className:"size-5 text-fg-subtle"}),"No issues in this view"]})}},l={args:{enableRowSelection:!1,enableGlobalFilter:!1,enableColumnVisibility:!1,pageSize:5}},c={args:{pageSize:50,stickyHeader:!0,containerClassName:"max-h-96"}},d={render:e=>{const[a,v]=f.useState(y),[m,N]=f.useState(null);return s.jsxs("div",{className:"flex flex-col gap-3",children:[s.jsxs("div",{className:"flex items-center justify-between",children:[s.jsx("h2",{className:"text-base font-semibold text-fg",children:"Engineering · All issues"}),m?s.jsxs("span",{className:"text-xs text-fg-muted",children:["Opened ",m.id,": ",m.title]}):null]}),s.jsx(w,{...e,data:a,columns:S,getRowId:u=>u.id,onRowClick:N,toolbar:s.jsx(b,{size:"sm",variant:"primary",icon:s.jsx(I,{}),children:"New issue"}),selectionActions:(u,k)=>s.jsx(b,{size:"xs",variant:"secondary",icon:s.jsx(L,{}),onClick:()=>{const j=new Set(u.map(p=>p.id));v(p=>p.filter(C=>!j.has(C.id))),k()},children:"Archive"})})]})}},q=["Playground","Loading","Empty","Minimal","StickyHeader","InContext"];i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:"{}",...i.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    loading: true
  }
}`,...o.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    data: [],
    emptyState: <span className="flex flex-col items-center gap-1">
        <Inbox className="size-5 text-fg-subtle" />
        No issues in this view
      </span>
  }
}`,...r.parameters?.docs?.source}}};l.parameters={...l.parameters,docs:{...l.parameters?.docs,source:{originalSource:`{
  args: {
    enableRowSelection: false,
    enableGlobalFilter: false,
    enableColumnVisibility: false,
    pageSize: 5
  }
}`,...l.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  args: {
    pageSize: 50,
    stickyHeader: true,
    containerClassName: "max-h-96"
  }
}`,...c.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: args => {
    const [data, setData] = useState(issues);
    const [opened, setOpened] = useState<Issue | null>(null);
    return <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-fg">
            Engineering · All issues
          </h2>
          {opened ? <span className="text-xs text-fg-muted">
              Opened {opened.id}: {opened.title}
            </span> : null}
        </div>
        <DataTable {...args} data={data} columns={columns} getRowId={issue => issue.id} onRowClick={setOpened} toolbar={<Button size="sm" variant="primary" icon={<Plus />}>
              New issue
            </Button>} selectionActions={(rows, clear) => <Button size="xs" variant="secondary" icon={<Archive />} onClick={() => {
        const ids = new Set(rows.map(row => row.id));
        setData(all => all.filter(issue => !ids.has(issue.id)));
        clear();
      }}>
              Archive
            </Button>} />
      </div>;
  }
}`,...d.parameters?.docs?.source}}};export{r as Empty,d as InContext,o as Loading,l as Minimal,i as Playground,c as StickyHeader,q as __namedExportsOrder,K as default};
