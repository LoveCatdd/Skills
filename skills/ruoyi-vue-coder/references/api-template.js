import request from '@/utils/request'

/**
 * 查询{{TABLE_COMMENT}}列表
 */
export function {{LIST_API}}(query) {
  return request({
    url: '{{API_PATH}}/list',
    method: 'get',
    params: query
  })
}

/**
 * 查询{{TABLE_COMMENT}}详情
 */
export function {{GET_API}}({{PK_FIELD}}) {
  return request({
    url: '{{API_PATH}}/' + {{PK_FIELD}},
    method: 'get'
  })
}

/**
 * 新增{{TABLE_COMMENT}}
 */
export function {{ADD_API}}(data) {
  return request({
    url: '{{API_PATH}}',
    method: 'post',
    data: data
  })
}

/**
 * 修改{{TABLE_COMMENT}}
 */
export function {{UPDATE_API}}(data) {
  return request({
    url: '{{API_PATH}}',
    method: 'put',
    data: data
  })
}

/**
 * 删除{{TABLE_COMMENT}}
 */
export function {{DEL_API}}({{PK_FIELD}}s) {
  return request({
    url: '{{API_PATH}}/' + {{PK_FIELD}}s,
    method: 'delete'
  })
}

/**
 * 导出{{TABLE_COMMENT}}
 */
export function export{{DOMAIN_NAME}}Api(query) {
  return request({
    url: '{{API_PATH}}/export',
    method: 'post',
    params: query
  })
}
