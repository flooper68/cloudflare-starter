import{bi as l,j as e,bj as i,bk as m,bl as s,bm as u,bn as j,bo as T,bp as r,x as p,h as g,bq as N}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const x=[{name:"Mobile app v3",lead:"Margaret Hamilton",status:"in_progress",health:"At risk",issues:32,target:"Nov 14"},{name:"Billing v2",lead:"Grace Hopper",status:"in_review",health:"On track",issues:18,target:"Nov 2"},{name:"Search relevance",lead:"Alan Turing",status:"todo",health:"On track",issues:9,target:"Dec 5"},{name:"SSO for enterprise",lead:"Barbara Liskov",status:"done",health:"Done",issues:24,target:"Oct 20"},{name:"Onboarding checklist",lead:"Katherine Johnson",status:"backlog",health:"No updates",issues:6,target:"—"}],f={"At risk":"warning","On track":"success",Done:"accent","No updates":"neutral"},v={title:"Data display/Table",component:l,tags:["autodocs"],args:{stickyHeader:!1},parameters:{layout:"padded",docs:{description:{component:"Styled table primitives for static data: dense rows, hairline separators, hover, and\nan optional sticky header. For sorting, selection and pagination use `DataTable`."}}}};function t(){return e.jsx(e.Fragment,{children:x.map(a=>e.jsxs(m,{children:[e.jsx(s,{children:e.jsxs("span",{className:"flex items-center gap-2",children:[e.jsx(p,{status:a.status}),e.jsx("span",{className:"font-medium",children:a.name})]})}),e.jsx(s,{children:e.jsxs("span",{className:"flex items-center gap-2 text-fg-muted",children:[e.jsx(g,{name:a.lead,size:"sm"}),a.lead]})}),e.jsx(s,{children:e.jsx(N,{size:"sm",dot:!0,tone:f[a.health],children:a.health})}),e.jsx(s,{className:"text-right tabular-nums text-fg-muted",children:a.issues}),e.jsx(s,{className:"text-fg-muted",children:a.target})]},a.name))})}function h(){return e.jsx(T,{children:e.jsxs(m,{children:[e.jsx(r,{children:"Project"}),e.jsx(r,{children:"Lead"}),e.jsx(r,{children:"Health"}),e.jsx(r,{className:"text-right",children:"Issues"}),e.jsx(r,{children:"Target"})]})})}const n={render:a=>e.jsx("div",{className:"rounded-lg border border-line",children:e.jsxs(l,{...a,children:[e.jsx(h,{}),e.jsx(i,{children:e.jsx(t,{})})]})})},o={render:()=>e.jsxs(l,{children:[e.jsx(u,{children:"Active projects in the Platform team."}),e.jsx(h,{}),e.jsx(i,{children:e.jsx(t,{})}),e.jsx(j,{children:e.jsxs(m,{children:[e.jsx(s,{colSpan:3,children:"Total"}),e.jsx(s,{className:"text-right tabular-nums",children:"89"}),e.jsx(s,{})]})})]})},d={render:()=>e.jsxs(l,{children:[e.jsx(h,{}),e.jsx(i,{children:x.slice(0,3).map((a,b)=>e.jsxs(m,{selected:b===1,children:[e.jsx(s,{className:"font-medium",children:a.name}),e.jsx(s,{className:"text-fg-muted",children:a.lead}),e.jsx(s,{className:"text-fg-muted",children:a.health}),e.jsx(s,{className:"text-right tabular-nums",children:a.issues}),e.jsx(s,{className:"text-fg-muted",children:a.target})]},a.name))})]})},c={render:()=>e.jsx("div",{className:"rounded-lg border border-line",children:e.jsxs(l,{stickyHeader:!0,containerClassName:"max-h-64",children:[e.jsx(h,{}),e.jsxs(i,{children:[e.jsx(t,{}),e.jsx(t,{}),e.jsx(t,{})]})]})})},k=["Playground","WithCaptionAndFooter","SelectedRow","StickyHeader"];n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  render: args => <div className="rounded-lg border border-line">
      <Table {...args}>
        <ProjectHeader />
        <TableBody>
          <ProjectRows />
        </TableBody>
      </Table>
    </div>
}`,...n.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  render: () => <Table>
      <TableCaption>Active projects in the Platform team.</TableCaption>
      <ProjectHeader />
      <TableBody>
        <ProjectRows />
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total</TableCell>
          <TableCell className="text-right tabular-nums">89</TableCell>
          <TableCell />
        </TableRow>
      </TableFooter>
    </Table>
}`,...o.parameters?.docs?.source}}};d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  render: () => <Table>
      <ProjectHeader />
      <TableBody>
        {projects.slice(0, 3).map((project, index) => <TableRow key={project.name} selected={index === 1}>
            <TableCell className="font-medium">{project.name}</TableCell>
            <TableCell className="text-fg-muted">{project.lead}</TableCell>
            <TableCell className="text-fg-muted">{project.health}</TableCell>
            <TableCell className="text-right tabular-nums">
              {project.issues}
            </TableCell>
            <TableCell className="text-fg-muted">{project.target}</TableCell>
          </TableRow>)}
      </TableBody>
    </Table>
}`,...d.parameters?.docs?.source}}};c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  render: () => <div className="rounded-lg border border-line">
      <Table stickyHeader containerClassName="max-h-64">
        <ProjectHeader />
        <TableBody>
          <ProjectRows />
          <ProjectRows />
          <ProjectRows />
        </TableBody>
      </Table>
    </div>
}`,...c.parameters?.docs?.source}}};export{n as Playground,d as SelectedRow,c as StickyHeader,o as WithCaptionAndFooter,k as __namedExportsOrder,v as default};
