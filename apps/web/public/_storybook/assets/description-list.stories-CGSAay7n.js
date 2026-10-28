import{b9 as o,j as e,ba as s,B as a,x as d,E as p,h as u,b6 as c,bb as x,aP as g,bc as m,P as b}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const I={title:"Data display/DescriptionList",component:o,tags:["autodocs"],args:{orientation:"horizontal",labelWidth:"6.5rem"},argTypes:{orientation:{control:"inline-radio",options:["horizontal","vertical"]}},parameters:{docs:{description:{component:`Label–value pairs, like the properties panel of a Linear issue. Horizontal by default
(label column + value column), vertical for narrow places. Values can be text or
ghost buttons that open pickers.`}}}},t={render:l=>e.jsxs(o,{...l,className:"w-80",children:[e.jsx(s,{label:"Workspace",children:"Acme Inc."}),e.jsx(s,{label:"Plan",children:"Business, 48 seats"}),e.jsx(s,{label:"Region",children:"EU (Frankfurt)"}),e.jsx(s,{label:"Created",children:"March 3, 2024"})]})},r={args:{orientation:"vertical"},render:l=>e.jsxs(o,{...l,className:"w-64",children:[e.jsx(s,{label:"API key",children:e.jsx("code",{className:"font-mono text-xs",children:"lin_api_••••••••3f9a"})}),e.jsx(s,{label:"Last used",children:"2 hours ago from 81.2.69.160"}),e.jsx(s,{label:"Scopes",children:"read, write, issues:create"})]})},n="-ml-2 h-7 justify-start px-2 text-fg font-normal",i={render:()=>e.jsxs("aside",{className:"flex w-72 flex-col gap-4 rounded-lg border border-line bg-surface p-4",children:[e.jsx("h3",{className:"text-xs font-medium text-fg-muted",children:"Properties"}),e.jsxs(o,{children:[e.jsx(s,{label:"Status",children:e.jsx(a,{variant:"ghost",size:"sm",className:n,icon:e.jsx(d,{status:"in_progress",label:""}),children:"In Progress"})}),e.jsx(s,{label:"Priority",children:e.jsx(a,{variant:"ghost",size:"sm",className:n,icon:e.jsx(p,{priority:"urgent",label:""}),children:"Urgent"})}),e.jsx(s,{label:"Assignee",children:e.jsx(a,{variant:"ghost",size:"sm",className:n,icon:e.jsx(u,{name:"Ada Lovelace",size:"xs"}),children:"Ada Lovelace"})}),e.jsx(s,{label:"Labels",children:e.jsxs("span",{className:"flex flex-wrap gap-1",children:[e.jsx(c,{size:"sm",color:"danger",children:"Bug"}),e.jsx(c,{size:"sm",color:"warning",children:"Performance"})]})}),e.jsx(s,{label:"Project",children:e.jsx(x,{variant:"subtle",href:"#mobile-app-v3",children:"Mobile app v3"})}),e.jsx(s,{label:"Due date",children:e.jsx(a,{variant:"ghost",size:"sm",className:m(n,"text-fg-muted"),icon:e.jsx(g,{}),children:"Set due date"})}),e.jsx(s,{label:"Cycle",children:e.jsx(a,{variant:"ghost",size:"sm",className:m(n,"text-fg-muted"),icon:e.jsx(b,{}),children:"Add to cycle"})})]})]})},j=["Playground","Vertical","IssueSidebar"];t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  render: args => <DescriptionList {...args} className="w-80">
      <DescriptionItem label="Workspace">Acme Inc.</DescriptionItem>
      <DescriptionItem label="Plan">Business, 48 seats</DescriptionItem>
      <DescriptionItem label="Region">EU (Frankfurt)</DescriptionItem>
      <DescriptionItem label="Created">March 3, 2024</DescriptionItem>
    </DescriptionList>
}`,...t.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    orientation: "vertical"
  },
  render: args => <DescriptionList {...args} className="w-64">
      <DescriptionItem label="API key">
        <code className="font-mono text-xs">lin_api_••••••••3f9a</code>
      </DescriptionItem>
      <DescriptionItem label="Last used">
        2 hours ago from 81.2.69.160
      </DescriptionItem>
      <DescriptionItem label="Scopes">
        read, write, issues:create
      </DescriptionItem>
    </DescriptionList>
}`,...r.parameters?.docs?.source}}};i.parameters={...i.parameters,docs:{...i.parameters?.docs,source:{originalSource:`{
  render: () => <aside className="flex w-72 flex-col gap-4 rounded-lg border border-line bg-surface p-4">
      <h3 className="text-xs font-medium text-fg-muted">Properties</h3>
      <DescriptionList>
        <DescriptionItem label="Status">
          <Button variant="ghost" size="sm" className={value} icon={<StatusIcon status="in_progress" label="" />}>
            In Progress
          </Button>
        </DescriptionItem>
        <DescriptionItem label="Priority">
          <Button variant="ghost" size="sm" className={value} icon={<PriorityIcon priority="urgent" label="" />}>
            Urgent
          </Button>
        </DescriptionItem>
        <DescriptionItem label="Assignee">
          <Button variant="ghost" size="sm" className={value} icon={<Avatar name="Ada Lovelace" size="xs" />}>
            Ada Lovelace
          </Button>
        </DescriptionItem>
        <DescriptionItem label="Labels">
          <span className="flex flex-wrap gap-1">
            <Tag size="sm" color="danger">
              Bug
            </Tag>
            <Tag size="sm" color="warning">
              Performance
            </Tag>
          </span>
        </DescriptionItem>
        <DescriptionItem label="Project">
          <Link variant="subtle" href="#mobile-app-v3">
            Mobile app v3
          </Link>
        </DescriptionItem>
        <DescriptionItem label="Due date">
          <Button variant="ghost" size="sm" className={cn(value, "text-fg-muted")} icon={<CalendarDays />}>
            Set due date
          </Button>
        </DescriptionItem>
        <DescriptionItem label="Cycle">
          <Button variant="ghost" size="sm" className={cn(value, "text-fg-muted")} icon={<Plus />}>
            Add to cycle
          </Button>
        </DescriptionItem>
      </DescriptionList>
    </aside>
}`,...i.parameters?.docs?.source}}};export{i as IssueSidebar,t as Playground,r as Vertical,j as __namedExportsOrder,I as default};
