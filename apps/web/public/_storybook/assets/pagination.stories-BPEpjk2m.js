import{bt as u,r as d,j as p}from"./iframe-BjN4PNZi.js";import"./preload-helper-PPVm8Dsz.js";const h={title:"Navigation/Pagination",component:u,tags:["autodocs"],args:{page:1,pageCount:16,total:312,pageSize:20,pageSizeOptions:[10,20,50,100],siblingCount:1,compact:!1,onPageChange:()=>{},onPageSizeChange:()=>{}},decorators:[e=>p.jsx("div",{className:"w-[640px]",children:p.jsx(e,{})})],parameters:{docs:{description:{component:'Page navigation: "1–20 of 312", a page-size select, numbered pages with gaps, and\nprevious/next. Pages are 1-based. `DataTable` uses it in its footer.'}}}},a={render:e=>{const[m,c]=d.useState(e.page),[i,l]=d.useState(e.pageSize??20),S=e.total??312;return p.jsx(u,{...e,page:m,pageSize:i,pageCount:Math.ceil(S/i),onPageChange:c,onPageSizeChange:P=>{l(P),c(1)}})}},s={args:{page:8}},t={args:{page:16}},r={args:{page:2,pageCount:4,total:72}},o={args:{page:5,total:void 0,pageSizeOptions:void 0}},n={args:{page:3,compact:!0,pageSizeOptions:void 0}},g={args:{page:1,pageCount:0,total:0}},x=["Playground","Middle","LastPage","FewPages","PagesOnly","Compact","Empty"];a.parameters={...a.parameters,docs:{...a.parameters?.docs,source:{originalSource:`{
  render: args => {
    const [page, setPage] = useState(args.page);
    const [pageSize, setPageSize] = useState(args.pageSize ?? 20);
    const total = args.total ?? 312;
    return <Pagination {...args} page={page} pageSize={pageSize} pageCount={Math.ceil(total / pageSize)} onPageChange={setPage} onPageSizeChange={size => {
      setPageSize(size);
      setPage(1);
    }} />;
  }
}`,...a.parameters?.docs?.source}}};s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    page: 8
  }
}`,...s.parameters?.docs?.source}}};t.parameters={...t.parameters,docs:{...t.parameters?.docs,source:{originalSource:`{
  args: {
    page: 16
  }
}`,...t.parameters?.docs?.source}}};r.parameters={...r.parameters,docs:{...r.parameters?.docs,source:{originalSource:`{
  args: {
    page: 2,
    pageCount: 4,
    total: 72
  }
}`,...r.parameters?.docs?.source}}};o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{
  args: {
    page: 5,
    total: undefined,
    pageSizeOptions: undefined
  }
}`,...o.parameters?.docs?.source}}};n.parameters={...n.parameters,docs:{...n.parameters?.docs,source:{originalSource:`{
  args: {
    page: 3,
    compact: true,
    pageSizeOptions: undefined
  }
}`,...n.parameters?.docs?.source}}};g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    page: 1,
    pageCount: 0,
    total: 0
  }
}`,...g.parameters?.docs?.source}}};export{n as Compact,g as Empty,r as FewPages,t as LastPage,s as Middle,o as PagesOnly,a as Playground,x as __namedExportsOrder,h as default};
